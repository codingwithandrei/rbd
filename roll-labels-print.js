// Child roll labels (4x3): logo + QR on top, big label number below.
// Blank labels show only the number; linked labels also show lot, stock, size, length and job.
const RollLabelPrint = {
    // Add one label to a container and draw its QR code
    append(container, label, roll, qrElementId) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label-print-item roll-label';
        labelDiv.innerHTML = `
            <div class="label-content">
                <div class="label-top-section">
                    <div class="label-logo">
                        <img src="rbd-logo.png.png" alt="RBD Logo" />
                    </div>
                    <div class="label-qr-code" id="${qrElementId}"></div>
                </div>
                <div class="label-info">
                    ${roll ? `
                        <div class="label-roll-no">${label.shortNo} &middot; ${roll.width}mm &times; ${roll.lengthM}m</div>
                        <div class="label-line"><strong>Lot:</strong> ${roll.lotNumber} &nbsp; <strong>Stock:</strong> ${roll.stockNumber}</div>
                        <div class="label-line">${roll.isOffcut ? '<strong>Offcut</strong>' : `<strong>Job:</strong> ${roll.jobId}`} &nbsp; ${RollLabelPrint._date(roll.createdAt)}</div>
                    ` : `
                        <div class="label-roll-no label-roll-no-blank">${label.shortNo}</div>
                    `}
                </div>
            </div>
        `;
        container.appendChild(labelDiv);

        const qrElement = document.getElementById(qrElementId);
        try {
            new QRCode(qrElement, {
                text: DB.rollLabels.url(label.code || label.id),
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                // Medium error correction: bigger squares than High, easier to scan; no logo covers the QR
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (error) {
            console.error('QR Code generation error:', error);
            qrElement.innerHTML = '<p style="color: var(--error-red);">QR Error</p>';
        }
        return labelDiv;
    },

    _date(value) {
        const date = value ? new Date(value) : new Date();
        return isNaN(date) ? new Date().toLocaleDateString() : date.toLocaleDateString();
    },

    // Print labels through #printView (print CSS only shows that element).
    // items: [{ label, roll }] - roll is null for blank labels
    print(items) {
        const printView = document.getElementById('printView');
        printView.innerHTML = '';
        items.forEach((item, index) => {
            RollLabelPrint.append(printView, item.label, item.roll, `print-roll-qr-${index}`);
        });

        setTimeout(() => {
            printView.style.display = 'block';
            printView.style.visibility = 'visible';

            setTimeout(() => {
                window.print();

                setTimeout(() => {
                    printView.style.display = 'none';
                    printView.style.visibility = 'hidden';
                }, 1000);
            }, 300);
        }, 800);
    }
};
