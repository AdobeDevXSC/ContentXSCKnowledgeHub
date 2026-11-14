# Stage Knowledge Hub CDN configuration

This initial configuration is limited to `stage.xscknowledgehub.adobe.com`.
Its CDN rule selects `knowledge-hub-stage-cug`; the function proxies to the
fixed Stage EDS origin configured in its package. Keep this Stage CDN and
Edge Function separate from production.

The `EdgeFunctions` file registers only this function. Preserve any other
Stage-only routes or function registrations when deploying. No configuration
pipeline is run as part of this change.
