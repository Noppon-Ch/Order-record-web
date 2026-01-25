import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function inspectPdf(filePath: string) {
    try {
        const absolutePath = path.resolve(filePath);
        console.log(`\n--- Inspecting: ${path.basename(filePath)} ---`);
        const pdfBytes = await fs.readFile(absolutePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        if (fields.length === 0) {
            console.log('No form fields found.');
        } else {
            fields.forEach(field => {
                const type = field.constructor.name;
                const name = field.getName();
                console.log(`- [${type}] ${name}`);
            });
        }
    } catch (error) {
        console.error(`Error inspecting ${filePath}:`, error);
    }
}

async function main() {
    const pdfFiles = [
        'public/pdf/ContinueOrderForm2025.pdf',
        'public/pdf/FirstOrderForm.pdf',
        'public/pdf/Mate_Form.pdf'
    ];

    for (const file of pdfFiles) {
        await inspectPdf(file);
    }
}

main();
