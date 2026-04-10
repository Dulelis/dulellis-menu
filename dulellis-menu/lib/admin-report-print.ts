export type SpreadsheetReportAlign = 'left' | 'center' | 'right';

export type SpreadsheetReportMetric = {
  label: string;
  value: string;
};

export type SpreadsheetReportColumn = {
  label: string;
  width?: string;
  align?: SpreadsheetReportAlign;
};

export type SpreadsheetReportCell = {
  value: string;
  align?: SpreadsheetReportAlign;
};

export type SpreadsheetReportSection = {
  title: string;
  subtitle?: string;
  metrics?: SpreadsheetReportMetric[];
  columns: SpreadsheetReportColumn[];
  rows: SpreadsheetReportCell[][];
  emptyMessage?: string;
  footer?: string;
};

export type SpreadsheetReportOptions = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  metrics?: SpreadsheetReportMetric[];
  sections: SpreadsheetReportSection[];
  orientation?: 'portrait' | 'landscape';
  popupFeatures?: string;
  brand?: string;
  documentTitle?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderValue(value: unknown) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function renderMetricsTable(metrics: SpreadsheetReportMetric[]) {
  if (!metrics.length) return '';

  const headers = metrics.map((metric) => `<th>${renderValue(metric.label)}</th>`).join('');
  const values = metrics.map((metric) => `<td>${renderValue(metric.value)}</td>`).join('');

  return `
    <table class="report-grid report-summary">
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        <tr>${values}</tr>
      </tbody>
    </table>
  `;
}

export function openSpreadsheetReport(options: SpreadsheetReportOptions) {
  if (typeof window === 'undefined') return false;

  const popup = window.open('', '_blank', options.popupFeatures || 'width=1180,height=760');
  if (!popup) return false;

  const brand = options.brand || 'Dulelis Confeitaria';
  const generatedAt = options.generatedAt || new Date().toLocaleString('pt-BR');
  const headerMetrics = renderMetricsTable(options.metrics || []);

  const sectionsHtml = options.sections
    .map((section) => {
      const headerHtml = section.columns
        .map((column) => `<th style="${column.width ? `width:${column.width};` : ''} text-align:${column.align || 'left'};">${renderValue(column.label)}</th>`)
        .join('');

      const bodyHtml = section.rows.length
        ? section.rows
            .map(
              (row) => `
                <tr>
                  ${row
                    .map(
                      (cell) => `
                        <td style="text-align:${cell.align || 'left'};">${renderValue(cell.value)}</td>
                      `,
                    )
                    .join('')}
                </tr>
              `,
            )
            .join('')
        : `
          <tr>
            <td colspan="${section.columns.length}" class="empty-row">${renderValue(section.emptyMessage || 'Sem registros para este relatorio.')}</td>
          </tr>
        `;

      return `
        <section class="report-section">
          <div class="section-head">
            <h2>${renderValue(section.title)}</h2>
            ${section.subtitle ? `<p>${renderValue(section.subtitle)}</p>` : ''}
          </div>
          ${section.metrics?.length ? renderMetricsTable(section.metrics) : ''}
          <table class="report-grid">
            <thead>
              <tr>${headerHtml}</tr>
            </thead>
            <tbody>${bodyHtml}</tbody>
          </table>
          ${section.footer ? `<div class="section-footer">${renderValue(section.footer)}</div>` : ''}
        </section>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${renderValue(options.documentTitle || options.title)}</title>
        <style>
          @page { size: A4 ${options.orientation || 'landscape'}; margin: 10mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fbf8f3; color: #26160f; font-family: Arial, sans-serif; }
          body { padding: 18px; }
          .report-shell { background: #ffffff; border: 1px solid #e6d6c3; }
          .report-header { padding: 18px 18px 12px; border-bottom: 2px solid #a96722; background: #fff8e6; }
          .report-brand { font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #7a5a3b; }
          .report-title { margin: 10px 0 0; font-size: 28px; line-height: 1.1; color: #26160f; }
          .report-subtitle { margin: 8px 0 0; font-size: 13px; color: #513620; font-weight: 700; }
          .report-meta { margin-top: 10px; font-size: 12px; color: #7a5a3b; }
          .report-body { padding: 14px 18px 18px; }
          .report-section + .report-section { margin-top: 18px; }
          .section-head { margin-bottom: 8px; }
          .section-head h2 { margin: 0; font-size: 18px; color: #26160f; }
          .section-head p { margin: 6px 0 0; font-size: 12px; color: #7a5a3b; font-weight: 700; }
          .report-grid { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; }
          .report-grid th,
          .report-grid td { border: 1px solid #d0b99e; padding: 8px 10px; vertical-align: top; font-size: 12px; word-break: break-word; }
          .report-grid th { background: #f9e9bc; color: #26160f; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
          .report-grid tbody tr:nth-child(even) td { background: #fbf8f3; }
          .report-summary { margin-top: 12px; }
          .report-summary td { font-weight: 700; font-size: 14px; background: #ffffff; }
          .empty-row { text-align: center; color: #7a5a3b; font-style: italic; }
          .section-footer { margin-top: 8px; font-size: 11px; color: #7a5a3b; font-weight: 700; }
          @media print {
            html, body { background: #ffffff; }
            body { padding: 0; }
            .report-shell { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-shell">
          <header class="report-header">
            <div class="report-brand">${renderValue(brand)}</div>
            <h1 class="report-title">${renderValue(options.title)}</h1>
            ${options.subtitle ? `<p class="report-subtitle">${renderValue(options.subtitle)}</p>` : ''}
            <div class="report-meta">Gerado em: ${renderValue(generatedAt)}</div>
            ${headerMetrics}
          </header>
          <main class="report-body">
            ${sectionsHtml}
          </main>
        </div>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}
