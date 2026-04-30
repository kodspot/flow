/**
 * All monetary amounts are stored as integer paise (1 INR = 100 paise).
 * Never use floats for money.
 */

export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function formatINR(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** "₹5,600" style without decimals when whole rupees */
export function formatINRCompact(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  const isWhole = rupees % 1 === 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: isWhole ? 0 : 2,
    minimumFractionDigits: isWhole ? 0 : 2,
  }).format(rupees);
}

/** Convert a paise amount to Indian-English words: "Rupees Five Thousand Six Hundred Only" */
export function amountInWords(paise: Paise): string {
  const rupees = Math.floor(paise / 100);
  const paisePart = paise % 100;
  const rupeesWords = numberToIndianWords(rupees);
  if (paisePart === 0) {
    return `Rupees ${rupeesWords} Only`;
  }
  return `Rupees ${rupeesWords} and ${numberToIndianWords(paisePart)} Paise Only`;
}

function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n]!;
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t]! + (o ? ' ' + ones[o] : '');
  };

  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let s = '';
    if (h) s += ones[h] + ' Hundred';
    if (rest) s += (s ? ' ' : '') + twoDigits(rest);
    return s;
  };

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;

  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ').trim();
}
