export function shouldEnableDevtool(isBrowser: boolean, isProduction: boolean, deploymentMode?: string): boolean {
  const disableDevtool = deploymentMode === 'true' || deploymentMode === '1';
  return isBrowser && isProduction && !disableDevtool;
}

export async function initializeDevtoolDeterrent(isBrowser: boolean, isProduction: boolean, deploymentMode?: string): Promise<void> {
  if (!shouldEnableDevtool(isBrowser, isProduction, deploymentMode)) return;
  try {
    const { default: DisableDevtool } = await import('disable-devtool');
    DisableDevtool({
      disableMenu: true,
      disableSelect: false,
      disableInputSelect: false,
      disableCopy: false,
      disableCut: false,
      disablePaste: false,
      clearLog: false,
      ondevtoolopen: (_type, next) => next(),
    });
  } catch (error) {
    // A browser detector must not prevent clinical workflows from loading.
    console.warn('DevTools deterrent could not initialize.', error);
  }
}
