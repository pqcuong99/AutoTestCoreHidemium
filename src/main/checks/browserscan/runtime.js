/**
 * Chay function trong main document qua CDP.
 * BrowserScan thuong thay execution context khi hydrate/quang cao dieu huong.
 */
async function evaluateInPage(page, fn, arg) {
  const session = await page.context().newCDPSession(page);
  const hasArg = arguments.length >= 3;
  const serializedArg = hasArg ? JSON.stringify(arg) : '';
  const expression = `(${fn.toString()})(${serializedArg})`;
  let lastError;

  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const response = await session.send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
          userGesture: true,
        });
        if (response.exceptionDetails) {
          const detail =
            response.exceptionDetails.exception?.description ||
            response.exceptionDetails.text ||
            'Runtime.evaluate failed';
          throw new Error(detail);
        }
        return response.result?.value;
      } catch (error) {
        lastError = error;
        const transient =
          /context|navigation|target|session|detached|destroyed/i.test(
            error?.message || ''
          );
        if (!transient || attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  } finally {
    await session.detach().catch(() => {});
  }

  throw lastError || new Error('BrowserScan runtime failed');
}

module.exports = { evaluateInPage };
