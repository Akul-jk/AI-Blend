# UCI household candidate dataset

The isolated candidate training script uses the UCI Machine Learning Repository's
[Individual Household Electric Power Consumption dataset](https://archive.ics.uci.edu/dataset/235/individual%2Bhousehold%2Belectric%2Bpower%2Bconsumption)
(DOI: `10.24432/C58K54`), distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Please retain this attribution when reusing derived models or results.

The observations come from one home in Sceaux, France, recorded at one-minute
intervals from December 2006 through November 2010. This supports an aggregate
household energy forecast. Its sub-metering channels represent broad groups
(kitchen, laundry, and water heating/air conditioning), not identified individual
appliances, so the candidate cannot provide appliance-specific predictions.

## Reproduce training

Download the official archive and extract `household_power_consumption.txt` to
`ml-service/datasets/external/uci-household/`. The downloaded dataset is excluded
from Git. With the project's Python environment installed, run:

```powershell
python ml-service/train_uci_household_candidate.py --epochs 12
```

Each run writes a unique package to `ml-service/models/candidates/`. It records
the source-file SHA-256, preprocessing, split boundaries, feature order, scalers,
and held-out metrics. Missing or incomplete five-minute bins are dropped; no
imputation is used. The model predicts aggregate energy for the next five minutes
from twelve five-minute history steps. Its held-out metrics are compared with a
last-observed-load persistence baseline.

The candidate is intentionally not registered or activated. The running app's
legacy inference contract is an appliance prediction with 19 features and a
five-second cadence. This dataset and model use household aggregate measurements
and a five-minute cadence, so using it in the app would be scientifically and
technically incompatible. Hardware validation has not been performed.
