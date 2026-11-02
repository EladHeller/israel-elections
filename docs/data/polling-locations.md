# Polling locations, Knesset 26

`elections-client/src/data/polling-locations-26.json` is a compact snapshot of GovMap layer 243670 (ריכוזי קלפיות כנסת 26), archived by Versions for the People on 2026-10-27, version 3 (`2f227334-3da2-4ae4-a44c-3dd307f30a14`).

Source: https://www.over.org.il/versions/5d2fcaf8-76bc-426f-a9f9-4828f0064535
CSV: https://www.over.org.il/api/versions/2f227334-3da2-4ae4-a44c-3dd307f30a14/download/נתוני%20הסורק

4,399 unique settlement/cluster pairs cover 12,018 polling stations according to the source counts. Keys join `settlement_code:cluster_code` to `סמל ישוב:ריכוז` in the results CSV. Retained fields: polling_station_location → name, polling_station_address → address, and WGS84 coordinates from geometry_wkt rounded to six decimals. Do not treat x/y (Israeli grid) as latitude/longitude. Locations apply only to election 26; missing matches show results without location controls. Maps load only after an explicit click; Google Maps links need no API key. OpenStreetMap embeds retain their built-in attribution.
