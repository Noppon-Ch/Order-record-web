import type { Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
// @ts-ignore
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs/promises';
import { customerService } from './customer.service.js';

export class CustomerPdfController {

    async download(req: Request, res: Response) {
        const handleDownload = async (token: string, isRetry = false) => {
            try {
                const customerId = req.params.customerId as string;
                const customer = await customerService.findById(customerId, token || (req.user as any)?.access_token);

                if (!customer) {
                    console.error("ERROR: Customer not found for ID:", customerId);
                    return res.status(404).send('Customer not found.');
                }

                const pdfDoc = await PDFDocument.create();
                pdfDoc.registerFontkit(fontkit);
                const page = pdfDoc.addPage();

                // Load fonts
                const fontPath = path.resolve(process.cwd(), 'public/fonts/THSarabun.ttf');
                const checkmarkFontPath = path.resolve(process.cwd(), 'public/fonts/WINGDNG2.TTF');

                let font;
                let checkmarkFont;

                try {
                    const [fontBytes, checkmarkFontBytes] = await Promise.all([
                        fs.readFile(fontPath),
                        fs.readFile(checkmarkFontPath)
                    ]);
                    font = await pdfDoc.embedFont(fontBytes);
                    checkmarkFont = await pdfDoc.embedFont(checkmarkFontBytes);
                } catch (err) {
                    console.warn("Fonts not found, using standard font. Thai characters might not display correctly.", err);
                    font = await pdfDoc.embedFont('Helvetica'); // Fallback
                    checkmarkFont = await pdfDoc.embedFont('Helvetica'); // Fallback
                }

                // Load background PDF
                const backgroundPdfPath = path.resolve(process.cwd(), 'public/pdf/Mate_Form.pdf');
                try {
                    const backgroundPdfBytes = await fs.readFile(backgroundPdfPath);
                    const backgroundPdfDoc = await PDFDocument.load(backgroundPdfBytes);
                    const [backgroundPage] = await pdfDoc.embedPages([backgroundPdfDoc.getPage(0)]);

                    if (backgroundPage) {
                        page.drawPage(backgroundPage, {
                            x: 0,
                            y: 0,
                            width: page.getWidth(),
                            height: page.getHeight()
                        });
                    }
                } catch (err) {
                    console.error("ERROR loading Mate_Form.pdf:", err);
                    return res.status(500).send("Cannot load PDF template.");
                }

                // Settings
                const fontSize = 14;
                const checkmarkFontSize = 20;
                const baselineGab = 3;
                const textColor = rgb(0, 0, 0);

                // Add text function
                const addText = (text: string | number | null | undefined, xEjs: number, yEjs: number, size = fontSize, color = textColor, useCheckmarkFont = false) => {
                    if (text === null || text === undefined) return;
                    const yPdf = page.getHeight() - yEjs + baselineGab;
                    page.drawText(String(text), {
                        x: xEjs,
                        y: yPdf,
                        font: useCheckmarkFont ? checkmarkFont! : font!,
                        size,
                        color,
                    });
                };

                const formatThaiDate = (dateString: string | Date | null) => {
                    if (!dateString) return { day: '-', month: '-', year: '-' };
                    const d = new Date(dateString);
                    if (isNaN(d.getTime())) return { day: '-', month: '-', year: '-' };

                    const day = d.toLocaleDateString('th-TH', { day: 'numeric' });
                    const monthNamesShort = [
                        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
                    ];
                    const month = monthNamesShort[d.getMonth()];
                    const year = (d.getFullYear() + 543).toString();
                    return { day, month, year };
                };

                const registerDateFormatted = formatThaiDate(customer.customer_registerdate);
                const birthDateFormatted = formatThaiDate(customer.customer_birthdate);

                // Recommender Name (Need to fetch if known) - For now using placeholder or empty if not in object
                // The service findAll maps recommender_name, but findById might not.
                // Let's check if we need to fetch it.
                let recommenderName = '';
                if (customer.customer_recommender_id) {
                    const recommender = await customerService.findByCitizenId(customer.customer_recommender_id, token || (req.user as any)?.access_token);
                    if (recommender) {
                        recommenderName = `${recommender.customer_fname_th || ''} ${recommender.customer_lname_th || ''}`.trim();
                    }
                }

                // ----------- Part 1 -----------
                addText(`${customer.customer_fname_en || ''} ${customer.customer_lname_en || ''}`.trim(), 221.9, 89.9);
                addText(`${customer.customer_fname_th || ''} ${customer.customer_lname_th || ''}`.trim(), 222.6, 104.6);
                addText(registerDateFormatted.day, 502.3, 90.4);
                addText(registerDateFormatted.month, 528.8, 90.4);
                addText(registerDateFormatted.year, 557.9, 90.4);
                addText(birthDateFormatted.day, 502.3, 104.8);
                addText(birthDateFormatted.month, 528.8, 104.8);
                addText(birthDateFormatted.year, 557.9, 104.8);

                // Gender checkmarks (P from WINGDNG2)
                if (customer.customer_gender === 'ชาย') {
                    addText('P', 82.3, 95.3, checkmarkFontSize, textColor, true);
                    addText('P', 82.3, 110.7, checkmarkFontSize, textColor, true);
                }
                if (customer.customer_gender === 'หญิง') {
                    addText('P', 121.1, 95.3, checkmarkFontSize, textColor, true);
                    addText('P', 121.1, 110.7, checkmarkFontSize, textColor, true);
                }
                if (customer.customer_gender === 'นิติบุคคล') {
                    addText('P', 188.1, 95.3, checkmarkFontSize, textColor, true);
                    addText('P', 188.1, 110.7, checkmarkFontSize, textColor, true);
                }

                addText(customer.customer_nationality || '', 47.2, 119.2);
                addText(customer.customer_citizen_id || '', 213.4, 119.2);
                addText(customer.customer_tax_id || '-', 445.2, 119.2);

                // Address concatenation
                const fullAddress = `${customer.customer_address1 || ''} ${customer.customer_address2 || ''}`.trim();
                addText(fullAddress, 133.5, 150.1);

                addText(customer.customer_zipcode || '', 137.6, 165.3);
                addText(customer.customer_phone || '', 381.6, 165.0);

                addText('-', 256.8, 165.0); // Phone placeholder
                addText('-', 503.2, 165.0); // Fax placeholder

                addText(recommenderName, 106.0, 180.4);
                addText(customer.customer_recommender_id || '-', 408.3, 179.5);

                // ----------- Part 2 -----------
                addText(`${customer.customer_fname_th || ''} ${customer.customer_lname_th || ''}`.trim(), 72.5, 610.4);
                addText(registerDateFormatted.day, 519.6, 610.4);
                addText(registerDateFormatted.month, 538.7, 610.4);
                addText(registerDateFormatted.year, 560.8, 610.4);
                addText(customer.customer_citizen_id || '', 385.0, 610.4);
                addText(fullAddress, 146.9, 626.2);
                addText(customer.customer_zipcode || '', 527.1, 626.2);
                addText('-', 136.6, 660.2); // Phone
                addText(customer.customer_phone || '', 297.5, 660.2); // Mobile
                addText('-', 477.0, 660.2); // Fax
                addText(recommenderName, 106.0, 708.0);
                addText(customer.customer_recommender_id || '-', 408.3, 708.0);

                // Save and send
                const pdfBytes = await pdfDoc.save();
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="customer_history_${customer.customer_citizen_id}.pdf"`);
                res.send(Buffer.from(pdfBytes));

            } catch (error: any) {
                console.error("ERROR during PDF generation:", error);
                if ((error?.message?.includes('JWT expired') || error?.code === 'PGRST303') && !isRetry) {
                    const refreshToken = req.cookies?.refresh_token;
                    if (refreshToken) {
                        try {
                            const { refreshSession } = await import('../auth/auth.service.js');
                            const { session, error: refreshError } = await refreshSession(refreshToken);

                            if (session && !refreshError) {
                                res.cookie('refresh_token', session.refresh_token, {
                                    httpOnly: true,
                                    secure: process.env.NODE_ENV === 'production',
                                    sameSite: 'lax',
                                    maxAge: 30 * 24 * 60 * 60 * 1000
                                });

                                if (req.user) (req.user as any).access_token = session.access_token;
                                return handleDownload(session.access_token, true);
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    // PDF download usually triggered by _blank, redirecting to login might show login in new tab?
                    // Or we could return a small HTML with script to close/redirect?
                    // Redirecting to login is standard.
                    return res.redirect('/login?session_expired=true');
                } else if (error?.message?.includes('JWT expired')) {
                    return res.redirect('/login?session_expired=true');
                }

                res.status(500).send('An error occurred while generating the PDF.');
            }
        }
        await handleDownload((req.user as any)?.access_token);
    }
}

export const customerPdfController = new CustomerPdfController();
