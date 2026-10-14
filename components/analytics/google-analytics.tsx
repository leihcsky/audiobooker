import Script from "next/script";

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function getGaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && MEASUREMENT_ID_PATTERN.test(id) ? id : null;
}

export function GoogleAnalytics() {
  const id = getGaMeasurementId();
  if (!id) {
    return null;
  }
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
