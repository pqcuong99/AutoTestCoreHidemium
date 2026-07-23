/**
 * Scrape Status (network + battery) tu #status-info tren CreepJS.
 * Self-contained — dung trong page.evaluate (khong import helper ngoai).
 */
function scrapeStatusInPage() {
  function xpathText(xpath) {
    try {
      const node = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return node ? (node.textContent || '').trim() : '';
    } catch {
      return '';
    }
  }

  const root = document.getElementById('status-info');
  const statusInfoText = root ? root.innerText || '' : '';
  const fingerprintText = xpathText('//*[@id="fingerprint-data"]');
  const batteryCellText = xpathText('//*[@id="fingerprint-data"]/div[14]/div[2]/div[2]');
  const safeText = [statusInfoText, fingerprintText, batteryCellText]
    .filter(Boolean)
    .join('\n');

  const out = {
    downlink: null,
    downlinkmax: null,
    effective_type: null,
    rtt: null,
    save_data: null,
    type: null,
    charging: null,
    charging_time: null,
    discharging_time: null,
    level: null,
  };

  const netBlock = safeText.match(/network:\s*([\s\S]*?)(?=\n\s*(?:battery|available)\s*:|$)/i);
  if (netBlock && !/unsupported/i.test(netBlock[1])) {
    const nb = netBlock[1];
    const rttLine = nb.match(/rtt:\s*([\d.]+)/i);
    const dlLine = nb.match(/downlink:\s*([\d.]+)/i);
    const maxLine = nb.match(/max:\s*([\d.]+|infinity)/i);
    const etLine = nb.match(/effectiveType:\s*(\S+)/i);
    const sdLine = nb.match(/saveData:\s*(\S+)/i);
    const typeLine = nb.match(/(?:^|[\n,])\s*type:\s*(\S+)/i);
    if (rttLine) out.rtt = Number(rttLine[1]);
    if (dlLine) out.downlink = Number(dlLine[1]);
    if (maxLine) {
      out.downlinkmax = /infinity/i.test(maxLine[1])
        ? Infinity
        : Number(maxLine[1]);
    }
    if (etLine) out.effective_type = etLine[1];
    if (sdLine) out.save_data = sdLine[1].replace(/[,;]+$/, '').toLowerCase();
    if (typeLine) out.type = typeLine[1];
  }

  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      if (out.downlink == null && c.downlink != null) out.downlink = c.downlink;
      if (out.rtt == null && c.rtt != null) out.rtt = c.rtt;
      if (out.effective_type == null && c.effectiveType) out.effective_type = c.effectiveType;
      if (out.save_data == null && c.saveData != null) out.save_data = String(c.saveData);
      if (out.downlinkmax == null && c.downlinkMax != null) out.downlinkmax = c.downlinkMax;
      if (out.type == null && c.type) out.type = c.type;
    }
  } catch { /* ignore */ }

  // Battery: unsupported / blocked tren desktop Mac
  if (/unsupported|blocked/i.test(batteryCellText)) {
    out._batteryUnsupported = true;
  }

  const batBlock = safeText.match(/battery:\s*([\s\S]*?)(?=\n\s*(?:available|network)\s*:|$)/i);
  if (batBlock) {
    const bb = batBlock[1];
    if (/unsupported|blocked/i.test(bb)) {
      out._batteryUnsupported = true;
    } else {
      const levelM = bb.match(/level:\s*([\d.]+)%/i);
      const chM = bb.match(/charging:\s*(true|false)/i);
      const ctM = bb.match(/charge time:\s*([^\n]+)/i);
      const dtM = bb.match(/discharge time:\s*([^\n]+)/i);
      if (levelM) out.level = Number(levelM[1]);
      if (chM) out.charging = chM[1];
      if (ctM) out.charging_time = ctM[1].trim();
      if (dtM) out.discharging_time = dtM[1].trim();
    }
  }

  return out;
}

module.exports = { scrapeStatusInPage };
