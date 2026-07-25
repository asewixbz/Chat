/**
 * Reliable clipboard copy function with fallback for non-HTTPS or iframe environments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Attempt 1: Modern navigator.clipboard API (if allowed and available)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, using fallback:', err);
    }
  }

  // Attempt 2: Fallback using document.execCommand('copy') with invisible textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Position fixed offscreen so it doesn't cause page jump
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    
    // Selection
    textArea.focus({ preventScroll: true });
    textArea.select();
    
    // For mobile iOS compatibility
    const range = document.createRange();
    range.selectNodeContents(textArea);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    textArea.setSelectionRange(0, 999999);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    }
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
  }

  return false;
}
