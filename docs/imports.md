# Sales import contract

CSV: UTF-8 (optional BOM), comma/semicolon/tab delimiter, first row unique headers. XLSX: first active worksheet, values only; formulas and external links are not executed. Encrypted archives and active chart-only sheets are rejected with a validation message. Choose a non-empty file ≤10 MiB, ≤100,000 data rows, ≤50 columns; uncompressed XLSX archives are bounded to 100 MiB / 1,000 entries. HTTP bodies (including chunked requests) are capped at 11 MiB. Headers ≤200 characters, cells ≤2,000 characters; normalized identifiers/dimensions ≤200 characters.

| Field | Required | Meaning/default |
| --- | --- | --- |
| order_id | yes | Order identifier; all lines of one order share date/customer/status/channel |
| order_date | yes | Strict ISO YYYY-MM-DD, never Unix timestamps (Excel date cells also accepted) |
| customer_id | yes | Stable customer identifier/name |
| product_name | yes | Product identifier/name; one line per order/product pair |
| quantity | yes | Integer 1–100,000 |
| unit_price | yes | Nonnegative USD Decimal, ≤2 decimals |
| category | no | Uncategorized |
| channel | no | Unknown |
| status | no | paid; allowed: paid, pending, cancelled, refunded |
| discount | no | Absolute line discount, default 0 |
| refund | no | Absolute line refund, default 0; nonzero requires refunded status |

Preview returns eight rows and inferred types from up to 100 values. Mapping associates model fields to source column names. Validation returns row/field/message errors (up to 1,000 messages) without saving facts. Final import validates again; no fabricated progress percentages are displayed. The UI shows the real request state until completion.

Imports are atomic: any invalid row causes zero imported lines, with a persisted failed job. Duplicate file hashes are rejected. Duplicate order/product keys inside the file are rejected. Order IDs already belonging to another dataset in the workspace are rejected even if file bytes differ. An explicit replace targets an existing workspace dataset and swaps its facts atomically; failure preserves the old source. Multiple new datasets with disjoint orders act as append-only sources. Upsert into arbitrary existing orders is not implemented.

Raw files are read privately from the upload stream and discarded; they are not placed in a public path or retained in the repository. Source names are display metadata only. All data is scoped to membership, and original filenames are sanitized. Formula-like CSV export cells receive an apostrophe prefix. Deleting a dataset cascades its facts; widgets referring to that source show an explicit error until reconfigured.

Validation preserves original physical row numbers, including blank lines and multiline CSV records. Malformed CSV quoting is rejected. XLSX row/column limits are checked against actual iteration as well as worksheet metadata, and workbooks close on success and failure. A replacement updates both facts and mapped schema metadata. Missing/foreign dataset previews return 404.
