"""Create the explicitly named, separate integration database without dropping any data."""
import os
from urllib.parse import urlsplit

import psycopg
from psycopg import sql

url=os.environ.get('TEST_DATABASE_URL','postgresql+psycopg://avenor:avenor@localhost:5432/avenor_test').replace('postgresql+psycopg:','postgresql:')
parts=urlsplit(url)
name=parts.path.lstrip('/')
if not name.endswith('_test'):
    raise SystemExit('Test database names must end in _test')
admin_url=url.rsplit('/',1)[0]+'/postgres'
with psycopg.connect(admin_url,autocommit=True) as connection:
    exists=connection.execute('SELECT 1 FROM pg_database WHERE datname=%s',(name,)).fetchone()
    if not exists:
        connection.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
print('Dedicated integration database is available.')
