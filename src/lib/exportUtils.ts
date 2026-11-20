import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportTableToPdf(options: {
  title: string;
  subtitle: string;
  storeName: string;
  headers: string[];
  rows: (string | number)[][];
  summaryLines?: { label: string; value: string }[];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(options.storeName || 'Zhie Catshop', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${options.title} — ${options.subtitle}`, 14, 19);

  let startY = 34;

  if (options.summaryLines && options.summaryLines.length > 0) {
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(9.5);
    options.summaryLines.forEach((line, idx) => {
      const y = startY + idx * 6;
      doc.setFont('helvetica', 'normal');
      doc.text(line.label, 14, y);
      doc.setFont('helvetica', 'bold');
      doc.text(line.value, 196, y, { align: 'right' });
    });
    startY += options.summaryLines.length * 6 + 6;
  }

  autoTable(doc, {
    startY,
    head: [options.headers],
    body: options.rows,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${options.filename}.pdf`);
}

export function exportTableToExcel(options: {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  summaryRows?: (string | number)[][];
  filename: string;
}) {
  const aoa: (string | number)[][] = [];
  if (options.summaryRows && options.summaryRows.length > 0) {
    aoa.push(...options.summaryRows);
    aoa.push([]);
  }
  aoa.push(options.headers);
  aoa.push(...options.rows);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${options.filename}.xlsx`);
}
