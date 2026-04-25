export type OrderReceiptItem = {
  quantity: number;
  name: string;
  total: string;
};

export type OrderReceiptData = {
  orderId: number | string;
  createdAt: string;
  customerName: string;
  whatsapp: string;
  address: string;
  neighborhood: string;
  city: string;
  cep: string;
  referencePoint: string;
  observation?: string | null;
  paymentTitle: string;
  paymentStatus: string;
  paymentDetail?: string | null;
  changeRequested?: string | null;
  changeDue?: string | null;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  qrCodeUrl?: string | null;
  items: OrderReceiptItem[];
};

type RenderOrderReceiptOptions = {
  visualize?: boolean;
};

type RenderOrderLoadingOptions = {
  orderId?: number | string;
  waitingForQz?: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderText(value: unknown) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function renderInfoLine(label: string, value: string | null | undefined) {
  if (!value) return "";

  return `
    <div class="receipt-line">
      <span class="receipt-label">${renderText(label)}</span>
      <span class="receipt-value">${renderText(value)}</span>
    </div>
  `;
}

export function writePopupHtml(
  popup: Window | null | undefined,
  html: string,
) {
  if (!popup || popup.closed) return false;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}

export function renderOrderPrintLoadingHtml(
  options: RenderOrderLoadingOptions = {},
) {
  const orderId =
    options.orderId === undefined || options.orderId === null
      ? ""
      : String(options.orderId);
  const title = options.waitingForQz
    ? "Aguardando autorizacao do QZ Tray"
    : "Preparando impressao";
  const hint = options.waitingForQz
    ? `
      <div class="hint">
        Se o QZ Tray abrir um aviso de seguranca, clique em <strong>Allow</strong> para liberar a impressao.
      </div>
    `
    : "";

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${renderText(title)}</title>
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; min-height: 100%; }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f8fafc;
            color: #0f172a;
            font-family: Arial, sans-serif;
          }
          .box {
            width: min(100%, 360px);
            padding: 28px 24px;
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 20px 45px rgba(15, 23, 42, 0.1);
            text-align: center;
          }
          h1 { margin: 0 0 8px; font-size: 18px; line-height: 1.2; }
          p { margin: 0; color: #475569; font-weight: 700; }
          .hint {
            margin-top: 14px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.45;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>${renderText(title)}</h1>
          <p>Pedido #${renderText(orderId)}</p>
          ${hint}
        </div>
      </body>
    </html>
  `;
}

export function renderOrderReceiptHtml(
  data: OrderReceiptData,
  options: RenderOrderReceiptOptions = {},
) {
  const visualize = Boolean(options.visualize);
  const toolbarHtml = visualize
    ? `
      <div class="preview-toolbar">
        <div>
          <div class="preview-title">Visualizar impressao</div>
          <div class="preview-subtitle">Pedido #${renderText(data.orderId)}</div>
        </div>
        <div class="preview-actions">
          <button type="button" onclick="window.print()">Imprimir</button>
          <button type="button" class="secondary" onclick="window.close()">Fechar</button>
        </div>
      </div>
      <div class="preview-shell">
        <div class="preview-frame">
    `
    : "";
  const toolbarCloseHtml = visualize
    ? `
        </div>
      </div>
    `
    : "";

  const itemsHtml = data.items.length
    ? data.items
        .map(
          (item) => `
            <tr>
              <td class="qty">${renderText(`${item.quantity}x`)}</td>
              <td class="name">${renderText(item.name)}</td>
              <td class="price">${renderText(item.total)}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td colspan="3" class="empty">Itens nao informados</td>
      </tr>
    `;

  const qrSectionHtml = data.qrCodeUrl
    ? `
      <section class="receipt-qr">
        <div class="receipt-qr-title">QR ENTREGA</div>
        <img id="maps-qrcode" alt="QR de entrega" />
        <p>Escaneie para aceitar e abrir no Maps</p>
      </section>
    `
    : "";

  const qrCodeUrlSerialized = JSON.stringify(data.qrCodeUrl || "");
  const initializationScript = visualize
    ? `
      window.addEventListener("load", () => {
        const qrCodeImageUrl = ${qrCodeUrlSerialized};
        const qrImage = document.getElementById("maps-qrcode");
        if (qrCodeImageUrl && qrImage instanceof HTMLImageElement) {
          qrImage.src = qrCodeImageUrl;
        }
      });
    `
    : `
      window.addEventListener("load", () => {
        const qrCodeImageUrl = ${qrCodeUrlSerialized};
        const printReceipt = () => {
          window.onafterprint = () => window.close();
          window.print();
        };
        const qrImage = document.getElementById("maps-qrcode");

        if (qrCodeImageUrl && qrImage instanceof HTMLImageElement) {
          qrImage.onload = printReceipt;
          qrImage.onerror = printReceipt;
          qrImage.src = qrCodeImageUrl;
          return;
        }

        printReceipt();
      });
    `;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pedido #${renderText(data.orderId)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #ffffff; }
          body {
            color: #111827;
            font-family: "Consolas", "Liberation Mono", "Courier New", monospace;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body.preview-mode { background: #e2e8f0; }
          .preview-toolbar {
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 18px;
            background: #0f172a;
            color: #f8fafc;
            font-family: Arial, sans-serif;
          }
          .preview-title {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .preview-subtitle {
            margin-top: 4px;
            font-size: 14px;
            font-weight: 700;
          }
          .preview-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .preview-actions button {
            border: none;
            border-radius: 999px;
            padding: 10px 16px;
            background: #f8fafc;
            color: #0f172a;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          .preview-actions button.secondary {
            background: rgba(248, 250, 252, 0.14);
            color: #f8fafc;
          }
          .preview-shell { padding: 18px; }
          .preview-frame {
            width: fit-content;
            margin: 0 auto;
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.15);
            padding: 14px;
          }
          .receipt {
            width: 72mm;
            padding: 3mm 3.2mm 4mm;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 1px dashed #94a3b8;
            padding-bottom: 2.5mm;
            margin-bottom: 2.5mm;
          }
          .receipt-brand {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .receipt-order {
            margin-top: 0.8mm;
            font-size: 11px;
            font-weight: 700;
          }
          .receipt-section + .receipt-section {
            margin-top: 2.3mm;
            padding-top: 2.3mm;
            border-top: 1px dashed #cbd5e1;
          }
          .receipt-line {
            display: grid;
            grid-template-columns: 19mm 1fr;
            gap: 1.8mm;
            align-items: start;
            font-size: 10px;
            line-height: 1.3;
          }
          .receipt-line + .receipt-line {
            margin-top: 0.9mm;
          }
          .receipt-label {
            font-weight: 700;
            text-transform: uppercase;
          }
          .receipt-value {
            font-weight: 500;
            word-break: break-word;
          }
          .receipt-items {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10px;
          }
          .receipt-items td {
            padding: 1.2mm 0;
            border-bottom: 1px dashed #dbe4ee;
            vertical-align: top;
          }
          .receipt-items .qty {
            width: 10mm;
            font-weight: 700;
          }
          .receipt-items .name {
            padding-right: 2mm;
            word-break: break-word;
          }
          .receipt-items .price {
            width: 19mm;
            text-align: right;
            white-space: nowrap;
            font-weight: 700;
          }
          .receipt-items .empty {
            text-align: center;
            color: #64748b;
            font-style: italic;
          }
          .receipt-summary-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            font-size: 10px;
            line-height: 1.3;
          }
          .receipt-summary-row + .receipt-summary-row {
            margin-top: 0.9mm;
          }
          .receipt-summary-label {
            font-weight: 700;
            text-transform: uppercase;
          }
          .receipt-summary-value {
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
          }
          .receipt-total {
            margin-top: 2mm;
            padding-top: 1.8mm;
            border-top: 1px dashed #94a3b8;
          }
          .receipt-total .receipt-summary-row {
            font-size: 12px;
          }
          .receipt-qr {
            margin-top: 2.6mm;
            padding-top: 2.2mm;
            border-top: 1px dashed #cbd5e1;
            text-align: center;
          }
          .receipt-qr-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
          }
          .receipt-qr img {
            display: block;
            width: 32mm;
            height: 32mm;
            object-fit: contain;
            margin: 2mm auto 1.2mm;
          }
          .receipt-qr p {
            margin: 0;
            font-size: 9px;
            line-height: 1.35;
            font-weight: 600;
          }
          @media print {
            html, body { background: #ffffff !important; }
            .preview-toolbar { display: none !important; }
            .preview-shell { padding: 0 !important; }
            .preview-frame {
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        </style>
      </head>
      <body class="${visualize ? "preview-mode" : ""}">
        ${toolbarHtml}
        <article class="receipt">
          <header class="receipt-header">
            <div class="receipt-brand">Dulelis Confeitaria</div>
            <div class="receipt-order">Pedido #${renderText(data.orderId)}</div>
          </header>

          <section class="receipt-section">
            ${renderInfoLine("Data", data.createdAt)}
            ${renderInfoLine("Cliente", data.customerName)}
            ${renderInfoLine("WhatsApp", data.whatsapp)}
            ${renderInfoLine("Endereco", data.address)}
            ${renderInfoLine("Bairro", data.neighborhood)}
            ${renderInfoLine("Cidade", data.city)}
            ${renderInfoLine("CEP", data.cep)}
            ${renderInfoLine("Ponto", data.referencePoint)}
            ${renderInfoLine("Observacao", data.observation)}
          </section>

          <section class="receipt-section">
            ${renderInfoLine("Pagamento", data.paymentTitle)}
            ${renderInfoLine("Status", data.paymentStatus)}
            ${renderInfoLine("Detalhe", data.paymentDetail)}
            ${renderInfoLine("Troco", data.changeDue)}
          </section>

          <section class="receipt-section">
            <table class="receipt-items">
              <tbody>${itemsHtml}</tbody>
            </table>
          </section>

          <section class="receipt-section">
            <div class="receipt-summary-row">
              <span class="receipt-summary-label">Subtotal</span>
              <span class="receipt-summary-value">${renderText(data.subtotal)}</span>
            </div>
            <div class="receipt-summary-row">
              <span class="receipt-summary-label">Entrega</span>
              <span class="receipt-summary-value">${renderText(data.deliveryFee)}</span>
            </div>
            <div class="receipt-summary-row">
              <span class="receipt-summary-label">Desconto</span>
              <span class="receipt-summary-value">${renderText(data.discount)}</span>
            </div>
            ${
              data.changeRequested
                ? `
                  <div class="receipt-summary-row">
                    <span class="receipt-summary-label">Troco para</span>
                    <span class="receipt-summary-value">${renderText(data.changeRequested)}</span>
                  </div>
                `
                : ""
            }
            ${
              data.changeDue
                ? `
                  <div class="receipt-summary-row">
                    <span class="receipt-summary-label">Troco</span>
                    <span class="receipt-summary-value">${renderText(data.changeDue)}</span>
                  </div>
                `
                : ""
            }
            <div class="receipt-total">
              <div class="receipt-summary-row">
                <span class="receipt-summary-label">Total</span>
                <span class="receipt-summary-value">${renderText(data.total)}</span>
              </div>
            </div>
          </section>

          ${qrSectionHtml}
        </article>
        ${toolbarCloseHtml}
        <script>
          ${initializationScript}
        </script>
      </body>
    </html>
  `;
}
