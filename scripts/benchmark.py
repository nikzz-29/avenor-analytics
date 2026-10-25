"""Measure actual bounded imports and SQL queries against a running API."""
import csv
import io
import json
import time
from datetime import datetime, UTC
from pathlib import Path
from uuid import uuid4

import httpx

results = []
with httpx.Client(base_url="http://localhost:8000/api/v1", timeout=180) as client:
    tag = uuid4().hex[:10]
    r = client.post('/auth/register', json={'name':'Import benchmark','email':f'bench-{tag}@example.com','password':uuid4().hex})
    r.raise_for_status()
    client.headers['x-csrf-token'] = client.cookies['avenor_csrf']
    for size in (10_000, 100_000):
        ws = client.post('/workspaces', json={'name':f'Benchmark {size}'}).json()
        base = f'/workspaces/{ws["id"]}'
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(['order_id','order_date','customer_id','product_name','quantity','unit_price'])
        for i in range(size):
            writer.writerow([f'BENCH-{i}','2025-06-01',f'Customer {i%1000}',f'Product {i%20}',1,'100.00'])
        content = stream.getvalue().encode()
        started = time.perf_counter()
        response = client.post(base+'/datasets/import', files={'file':('benchmark.csv',content,'text/csv')})
        elapsed = time.perf_counter()-started
        response.raise_for_status()
        assert response.json()['imported'] == size, response.text
        started = time.perf_counter()
        query = client.post(base+'/analytics/query', json={'metric':'revenue','dimension':'product_name'})
        query.raise_for_status()
        query_elapsed = time.perf_counter()-started
        from decimal import Decimal
        total = sum(Decimal(p['value']) for p in query.json()['points'])
        assert total == size*100
        results.append({'rows':size,'bytes':len(content),'import_seconds':round(elapsed,3),'query_seconds':round(query_elapsed,3),'revenue':str(total)})
        datasets = client.get(base+'/datasets').json()
        for dataset in datasets:
            client.delete(base+'/datasets/'+dataset['id']).raise_for_status()
report={'measured_at':datetime.now(UTC).isoformat(),'environment':'Python 3.12 / local PostgreSQL 17 Docker / single API process','measurements':results,'notes':'Single local run; synchronous atomic imports, 10 MiB / 100,000 row cap. Includes HTTP and validation; no throughput guarantee.'}
path=Path(__file__).resolve().parents[1]/'docs/benchmark.json'
path.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
