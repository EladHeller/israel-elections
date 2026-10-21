# Social sharing preview

The initial `elections-client/index.html` includes Open Graph and Twitter Card
metadata, so link previews work without executing JavaScript. All routes use a
general site preview; it does not represent a particular election or scenario.
Compact `/s/:id` links redirect to the simulator, which serves the same HTML.

The 120-seat illustration is decorative, not a result or poll. Its colors match
the site's navy and amber palette rather than political blocs.

- Published image: `elections-client/public/social/elections-preview-v1.png`
- Editable source: `elections-client/public/social/elections-preview-v1.svg`
- Size: 1200 × 630 pixels

Edit the SVG and export it to PNG at its original size (with Hebrew text shaping
and DejaVu Sans installed). Only the PNG is used for link previews. Increment
the version in both filenames and all image metadata when changing the image,
since social services cache preview images independently of CloudFront.

No fixed `og:url` is declared: shared simulator and historical-election links
should keep their own destination rather than being identified as the homepage.
The build uses `VITE_SITE_URL` for absolute image URLs. Deployment obtains this
from the CloudFormation `SiteUrl` output: the custom domain in production and
the distribution domain in development. Local builds default to production.

After deploying to production, check a newly shared URL in WhatsApp and in
Facebook Sharing Debugger / LinkedIn Post Inspector. Existing previews can stay
cached until the sharing service fetches the page again. Confirm that the public
image URL returns `200` with `Content-Type: image/png`.
