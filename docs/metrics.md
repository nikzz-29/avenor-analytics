# Metric definitions

All inputs represent **USD line-level sales**. No currency mixing/conversion, tax, cost of goods, profit, cash flow or forecasting is inferred. Importing data expressed in another currency requires conversion outside this release.

- Eligible statuses: `paid`, `refunded`. `pending` and `cancelled` have zero recognized net sales and are excluded from eligible order/customer/unit counts.
- Gross line sales = quantity × unit_price.
- Net line sales = gross − discount − refund for eligible lines; zero otherwise. Discount and refund are absolute **line amounts**, not percentages or order totals. Validation forbids negative values and discount + refund > gross.
- Revenue = SUM(net line sales). Partially and fully refunded orders remain eligible; their actual refunded amounts reduce revenue.
- Orders = COUNT(DISTINCT eligible order_id), not number of rows. Group-specific order counts can overlap when an order contains products in multiple categories. Do not sum those group counts to produce a total.
- AOV = net revenue / eligible distinct order count. No orders → null (`Not available`), not a fabricated zero.
- Active customers = COUNT(DISTINCT eligible customer_id) in the period.
- Returning customers = active customers with any eligible purchase **before the start** of the selected period, in the selected source/workspace. Multiple purchases only within the current period do not qualify.
- Units = SUM(quantity) for eligible lines. These are purchased units; refunded unit counts are not inferred from monetary refunds.
- Refunds = SUM(refund) for eligible lines, attributed to the supplied order date. The schema does not carry a separate refund event date.
- Revenue growth = (current revenue − previous revenue) / previous revenue × 100. Zero previous revenue → null. Previous window has the same number of calendar days and ends the day before current start.
- Generic `sum`, `average`, `minimum`, `maximum` operate on net line sales (including zero-recognition lines); `count` counts all source rows; `distinct_count` counts eligible customers.

All aggregation takes place in SQL. No order-level total is repeated through a JOIN. `QueryOut.total` is calculated from the complete filtered facts, independently of grouped/limited points: a KPI never sums averages or overlapping distinct counts. Dates are ISO calendar dates in UTC; date filters are inclusive. Day/week/month use PostgreSQL date_trunc; weeks start Monday. Missing time buckets are currently omitted rather than interpolated; charts are descriptive, not forecasts. Charts and exports cap grouped results at 500; the full filtered aggregate is still returned separately. Tables use exact server-computed Decimal net revenue.
