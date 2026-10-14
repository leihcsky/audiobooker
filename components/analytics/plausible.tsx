import Script from "next/script";

const SCRIPT_ID_PATTERN = /^pa-[A-Za-z0-9_-]+$/;

export function getPlausibleScriptId(): string | null {
  const id = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_ID?.trim();
  return id && SCRIPT_ID_PATTERN.test(id) ? id : null;
}

export function PlausibleAnalytics() {
  const id = getPlausibleScriptId();
  if (!id) {
    return null;
  }
  return (
    <>
      <Script src={`https://plausible.io/js/${id}.js`} strategy="afterInteractive" />
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
      </Script>
    </>
  );
}
