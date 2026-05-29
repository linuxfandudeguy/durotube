const CONFIG = {
  proxyEnabled: false,
  proxyURL: "https://uncors.vercel.app/"
};

function getProxyURL() {
  return CONFIG.proxyEnabled ? CONFIG.proxyURL : "";
}
