import type { Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
// @ts-ignore
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs/promises';
import { orderService } from './order.service.js';
import { customerService } from '../customers/customer.service.js';
import { getUserProfile } from '../users/user.service.js';

export class ContinueOrderPdfController {

    async download(req: Request, res: Response) {
        try {
            const orderId = req.params.orderId || req.params.id; // Support both just in case

            if (typeof orderId !== 'string') {
                return res.status(400).send('Invalid Order ID');
            }
            const accessToken = (req.user as any)?.access_token;
            // @ts-ignore
            const userId = req.user?.id || req.user?._id || req.user?.sub;

            const order = await orderService.getOrderById(orderId, accessToken);

            // Check if order exists before proceeding
            if (!order) {
                console.error("ERROR: Order not found for ID:", orderId);
                return res.status(404).send('Order not found.');
            }

            // Fetch Items
            const orderItems = await orderService.getOrderItems(orderId, accessToken);
            order.items = orderItems || [];

            // Fetch Buyer (Customer)
            const buyerDetails = await customerService.findById(order.order_customer_id, accessToken);


            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            const PAGE_WIDTH = 344.7;
            const PAGE_HEIGHT = 509.0;
            const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

            // Helper function to format numbers with comma and two decimal places
            const formatNumber = (num: any) => {
                let n = Number(num);
                if (isNaN(n)) n = 0;
                // Since DB stores Satang, divide by 100 for display
                n = n / 100;
                return n.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            };

            // Prepare items data
            // Map Supabase items to snippet structure
            const populatedItems = order.items.map((item: any) => {
                return {
                    productCode: item.product_code,
                    quantity: item.quantity,
                    productNameTH: item.product_name, // Assuming product_name stores the TH name or full name from frontend
                    colorTH: item.product_color,
                    size: item.product_size,
                    pricePerUnit: item.product_price, // Will be formatted later
                    subtotal: item.quantity * item.product_price
                };
            });

            // Track the current logged-in user object so we can safely access
            // properties like paymentPreference later in the function.
            let userPhone = '';
            let username = '';
            // ไม่ต้องดึง userAddress แล้ว
            let userPayment: any = null;
            let userPaymentChannel = '';
            let userPaymentBankName = '';
            let userPaymentRefNumber = '';

            if (userId) {
                try {
                    const loggedInUser = await getUserProfile(userId, accessToken);
                    if (loggedInUser) {
                        // Assuming Supabase user_profiles table has snake_case columns
                        // Need to verify column names. If they don't exist, these will be undefined.
                        // Snippet used: userPhone, username, paymentPreference

                        // Map potential fields
                        userPhone = loggedInUser.user_phone || loggedInUser.phone || loggedInUser.userPhone || '';
                        username = loggedInUser.username || loggedInUser.display_name || '';

                        // Payment preference - assuming it might be a JSON column or separate columns
                        // Snippet expected: paymentPreference: { channel, bankName, refNumber }
                        if (loggedInUser.payment_preference) {
                            userPayment = loggedInUser.payment_preference;
                        } else if (loggedInUser.paymentPreference) {
                            userPayment = loggedInUser.paymentPreference;
                        }

                        if (userPayment) {
                            userPaymentChannel = userPayment.channel || '';
                            userPaymentBankName = userPayment.bankName || userPayment.bank_name || '';
                            userPaymentRefNumber = userPayment.refNumber || userPayment.ref_number || '';
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user profile for PDF:", err);
                }
            }

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
                console.warn("Fonts not found, using standard font.", err);
                font = await pdfDoc.embedFont('Helvetica');
                checkmarkFont = await pdfDoc.embedFont('Helvetica');
            }


            // Load background PDF instead of image
            const backgroundPdfPath = path.resolve(process.cwd(), 'public/pdf/ContinueOrderForm2025.pdf');
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
                console.error("Error loading background pdf:", backgroundPdfPath, err);
            }

            const fontSize = 10;
            const checkmarkFontSize = 14;
            const baselineGab = 1; // ค่าปรับแก้สำหรับ baseline ของฟอนต์
            const textColor = rgb(0, 0, 0);

            /**
             * Helper function to add text to the PDF page.
             * Converts top-based Y coordinate (yEjs) to pdf-lib's bottom-based Y coordinate.
             * @param {string} text - The text content.
             * @param {number} xEjs - X coordinate (from left).
             * @param {number} yEjs - Y coordinate (from top).
             * @param {number} [size=fontSize] - Font size.
             * @param {object} [color=textColor] - Text color (rgb object).
             * @param {boolean} [useCheckmarkFont=false] - Whether to use the checkmark font.
             * @param {number} [letterSpacing=undefined] - Character spacing for the text.
             */
            const addText = (text: any, xEjs: number, yEjs: number, size = fontSize, color = textColor, useCheckmarkFont = false, letterSpacing: number | undefined = undefined) => {
                if (text === null || text === undefined) return;
                // pdf-lib's Y coordinate is from the bottom of the page.
                // yEjs is assumed to be from the top of the page.
                // baselineGab is an adjustment to align text properly on the baseline.
                const yPdf = page.getHeight() - yEjs + baselineGab;

                page.drawText(text.toString(), {
                    x: xEjs,
                    y: yPdf,
                    size,
                    font: useCheckmarkFont ? checkmarkFont! : font!,
                    color,
                    // @ts-ignore - letterSpacing might not be in all typedefs yet but supported in newer versions if passed to options
                    letterSpacing // Pass letterSpacing to drawText options
                });
            };

            /**
             * Formats a Date object into a Thai date string components.
             * @param {Date} date - The date object.
             * @returns {{day: string, month: string, year: string}} - Formatted date parts.
             */
            const formatThaiDate = (dateString: string | Date | null) => {
                if (!dateString) return { day: '-', month: '-', year: '-' };
                const d = new Date(dateString);
                if (isNaN(d.getTime())) return { day: '-', month: '-', year: '-' };
                return {
                    day: d.toLocaleDateString('th-TH', { day: 'numeric' }),
                    month: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()],
                    year: (d.getFullYear() + 543).toString()
                };
            };

            // Draw order date
            const orderDate = formatThaiDate(order.order_date);
            addText(orderDate.day, 115.3, 94.0, 10);
            addText(orderDate.month, 138.1, 94.0, 10);
            addText(orderDate.year, 163.6, 94.0, 10);

            // Safely access buyer details properties
            const buyerFirstNameEN = buyerDetails ? (buyerDetails.customer_fname_en || '') : '';
            const buyerLastNameEN = buyerDetails ? (buyerDetails.customer_lname_en || '') : '';
            const buyerPhone = buyerDetails ? (buyerDetails.customer_phone || '') : '';
            const buyerMobile = buyerDetails ? (buyerDetails.customer_phone || '') : ''; // Map both to phone or if DB has mobile

            const buyerFullNameTH = buyerDetails ? `${buyerDetails.customer_fname_th} ${buyerDetails.customer_lname_th}` : '';


            addText(`${buyerFirstNameEN} ${buyerLastNameEN}`.trim(), 84.3, 113.0);
            addText(buyerFullNameTH, 84.3, 122.4);

            /**
             * Draws text with manual letter spacing, character by character.
             * This is a workaround for fonts where pdf-lib's letterSpacing option might not work as expected.
             */
            const drawCitizenIDWithManualSpacing = (page: any, text: any, xEjs: number, yEjs: number, size: number, font: any, color: any, spacing: number, baselineGab: number) => {
                const yPdf = page.getHeight() - yEjs + baselineGab;
                let currentX = xEjs;

                // Ensure text is a string
                const textString = text ? text.toString() : '';

                for (let i = 0; i < textString.length; i++) {
                    const char = textString[i];
                    page.drawText(char, {
                        x: currentX,
                        y: yPdf,
                        size,
                        font,
                        color,
                    });
                    // Move currentX for the next character
                    currentX += font.widthOfTextAtSize(char, size) + spacing;
                }
            };

            // Use the new function to draw buyerCitizenID with manual letter spacing
            const buyerCitizenId = buyerDetails?.customer_citizen_id || '';
            drawCitizenIDWithManualSpacing(page, buyerCitizenId, 83.4, 144.5, 12, font, textColor, 4.0, baselineGab);


            const buyerFax = ''; // buyerDetails ? (buyerDetails.fax || '') : ''; // No fax in DB model seen so far
            addText(buyerPhone, 45.3, 131.3);
            addText(buyerMobile, 122.6, 131.3);

            // Draw buyer position checkmark
            const posMap: Record<string, { x: number, v: string | number }> = {
                BM: { x: 44.0, v: 0.8 },
                AG: { x: 72.9, v: 0.6 },
                SFAG: { x: 98.0, v: 0.5 },
                SAG: { x: 127.4, v: 0.4 },
                ESAG: { x: 155.8, v: 0.4 },

            };
            const pos = posMap[order.position];
            if (pos) {
                addText('P', pos.x, 157.0, checkmarkFontSize, textColor, true);
                addText(pos.v, 246.9, 80.7, 8);
            }


            // payment section
            const paymentMap: Record<string, { x: number }> = {
                counter: { x: 18.1 },
                atm: { x: 84.8 },
                mobile_app: { x: 146.0 },
                k_biz: { x: 240.9 },
            }
            const paymentChannel = paymentMap[userPaymentChannel];
            if (paymentChannel) {
                addText('P', paymentChannel.x, 198.0, checkmarkFontSize, textColor, true);
            }
            addText(userPaymentBankName || '', 54.7, 204.5);
            addText(userPaymentRefNumber || '', 166.5, 204.5);



            /**
             * Helper function to wrap text into multiple lines based on maxWidth.
             */
            const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
                const lines = [];
                if (!text || text.trim() === '') {
                    return ['']; // Return a single empty string for empty input to ensure at least one line is processed
                }

                // Replace explicit newlines with a unique placeholder before splitting by space
                // This ensures that existing newlines are respected during wrapping
                const newlinePlaceholder = '___NEWLINE___';
                const textWithPlaceholders = text.replace(/\n/g, ` ${newlinePlaceholder} `);
                const words = textWithPlaceholders.split(' ');
                let currentLine = '';

                for (const word of words) {
                    if (word === newlinePlaceholder) {
                        lines.push(currentLine.trim());
                        currentLine = '';
                        continue;
                    }

                    const testLine = currentLine === '' ? word : currentLine + ' ' + word;
                    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

                    if (testWidth <= maxWidth) {
                        currentLine = testLine;
                    } else {
                        // If adding the word exceeds maxWidth, push the current line and start a new one with the word
                        if (currentLine !== '') { // Only push if currentLine is not empty
                            lines.push(currentLine.trim());
                        }
                        currentLine = word;
                    }
                }
                if (currentLine !== '') { // Add the last line if it's not empty
                    lines.push(currentLine.trim());
                }

                // Filter out any empty lines that might result from wrapping,
                // but ensure that if the original text was just whitespace, we still return an empty line.
                return lines.filter(line => line.trim() !== '' || (text.trim() === '' && line === ''));
            };

            interface DrawTextBoxOptions {
                page: any;
                textLines: string[];
                x: number;
                yStart: number;
                maxWidth: number;
                lineHeight: number;
                fontSize: number;
                font: any;
                color?: any;
                baselineGab: number;
                topPadding?: number;
            }

            function drawTextBox({
                page,
                textLines, // Now this will be the pre-wrapped lines
                x,
                yStart,
                maxWidth, // maxWidth is still useful for context but not for wrapping inside this function
                lineHeight,
                fontSize,
                font,
                color = rgb(0, 0, 0),
                baselineGab,
                topPadding // optional: extra space above first line inside the box
            }: DrawTextBoxOptions) {
                // Padding inside the box
                const padX = 4; // horizontal padding
                const padBottom = 2; // bottom padding
                const padTop = typeof topPadding === 'number' ? topPadding : 10; // top padding (user requested extra top space)

                const linesCount = Array.isArray(textLines) && textLines.length ? textLines.length : 1;
                const contentHeight = lineHeight * linesCount;

                // Calculate rectangle position and size (convert from top-based coords to pdf-lib bottom-based coords)
                // rectangle top in top-based coordinates should be yStart - padTop
                // rectHeight covers padTop + contentHeight + padBottom
                const rectHeight = contentHeight + padTop + padBottom;
                const rectX = x - padX;
                const rectWidth = (typeof maxWidth === 'number' ? maxWidth : 0) + padX * 2;
                // rectBottomY: convert top-based (yStart - padTop) to bottom-based y
                const rectTopBasedY = yStart - padTop;
                const rectBottomY = page.getHeight() - rectTopBasedY - rectHeight + baselineGab;

                // Draw white background with black border
                try {
                    page.drawRectangle({
                        x: rectX,
                        y: rectBottomY,
                        width: rectWidth,
                        height: rectHeight,
                        color: rgb(1, 1, 1), // white fill
                        borderColor: rgb(0, 0, 0), // black border
                        borderWidth: 0.5
                    });
                } catch (err) {
                    // If drawRectangle options differ, fallback to draw filled rectangle then stroke
                    try {
                        page.drawRectangle({ x: rectX, y: rectBottomY, width: rectWidth, height: rectHeight, color: rgb(1, 1, 1) });
                        page.drawRectangle({ x: rectX, y: rectBottomY, width: rectWidth, height: rectHeight, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
                    } catch (e) {
                        // ignore
                    }
                }

                // Draw each line of text, starting at yStart (no extra top offset) so top spacing equals padTop
                textLines.forEach((line: string, idx: number) => {
                    // Calculate the top-based Y coordinate for the current line
                    const currentLineTopBasedY = yStart + (idx * lineHeight);

                    // Convert to pdf-lib's bottom-up Y coordinate, considering baselineGab
                    const yPdf = page.getHeight() - currentLineTopBasedY + baselineGab;

                    page.drawText(line.trim(), {
                        x,
                        y: yPdf,
                        size: fontSize,
                        font,
                        color,
                    });
                });
            }

            // Column X positions for items table (assuming these are correct for your template)
            const colX = {
                productCode: 19.5,
                productNameTH: 61.2,
                colorTH: 147.4,
                size: 176.6,
                pricePerUnit: 199.2,
                quantity: 240.0,
                subtotal: 272.0
            };
            // Y start position for the items table (assumed to be top-based)
            const rowYStart = 271.5;
            populatedItems.forEach((item: any, idx: number) => {
                // The Y coordinate here is also top-based, consistent with addText
                const y = rowYStart + idx * 12.0; //the fixed row height for items
                addText(item.productCode, colX.productCode, y, fontSize);
                addText(item.productNameTH, colX.productNameTH, y, 8);
                addText(item.colorTH, colX.colorTH, y, 6);
                addText(item.size, colX.size, y, fontSize);
                addText(formatNumber(item.pricePerUnit), colX.pricePerUnit, y, fontSize); // Applied formatNumber
                addText(item.quantity, colX.quantity, y, fontSize);
                addText(formatNumber(item.subtotal), colX.subtotal, y, fontSize); // Applied formatNumber
            });

            // Draw total amounts (assuming these coordinates are correct for your template)
            const orderTotalAmount = order.order_total_amount || 0;
            const orderSubtotalBeforeTax = order.order_price_before_tax || 0;
            const orderTax = order.order_tax || 0;
            const orderFinalPrice = order.order_final_price || 0;

            // Map fields based on logic:
            // Snippet: amount, subtotalBeforeTax, taxAmount, grandTotal
            // DB: order_total_amount -> amount (First box? or subtotal?)
            // DB: order_price_before_tax -> subtotalBeforeTax
            // DB: order_tax -> taxAmount
            // DB: order_final_price -> grandTotal

            addText(formatNumber(orderTotalAmount), 272.0, 391.0); // Applied formatNumber
            addText(formatNumber(orderTotalAmount), 206.2, 81.0); // Applied formatNumber
            addText(formatNumber(orderSubtotalBeforeTax), 288.1, 81.0); // Applied formatNumber
            addText(formatNumber(orderSubtotalBeforeTax), 288.1, 119.0); // Applied formatNumber
            addText((7), 222.1, 130.6); // This seems to be a fixed number 7, not a currency
            addText(formatNumber(orderTax), 288.1, 131.3); // Applied formatNumber
            addText(formatNumber(orderFinalPrice), 288.1, 144.0); // Applied formatNumber
            addText(formatNumber(orderFinalPrice), 58.8, 213.5); // Applied formatNumber for payment section


            // Draw username and user phone
            addText(`${username}: ${userPhone}`.trim(), 199.0, 169.4);

            // เปลี่ยนจาก userAddress เป็น order.address
            // ปรับให้แสดง note + address
            // Use customer address as fallback if order.address is missing? Snippet used order.address.
            // In our DB `orders` has `order_note`. It doesn't seem to have `order_address` (shipping addr). 
            // `first-order-pdf` constructed it from customer address.
            // Let's use logic: `order.order_note + customer address` 
            // But snippet says `order.address`. If `orders` table has `order_address` column? 
            // `first-order-pdf` used: `const shippingAddr = (order.order_note ? order.order_note + '\n' : '') + (fullAddress || '');`
            // usage:
            const buyerAddress1 = buyerDetails ? (buyerDetails.customer_address1 || '') : '';
            const buyerAddress2 = buyerDetails ? (buyerDetails.customer_address2 || '') : '';
            const buyerZipCode = buyerDetails ? (buyerDetails.customer_zipcode || '') : '';
            const fullAddress = `${buyerAddress1} ${buyerAddress2} ${buyerZipCode}`.trim();

            const noteAndAddress = (order.order_note ? order.order_note + '\n' : '') + (fullAddress || '');
            const wrappedShippingAddressLines = wrapText(noteAndAddress, font, 10, 174.7); // fontSize 10, maxWidth 174.7
            drawTextBox({
                page,
                textLines: wrappedShippingAddressLines,
                x: 19.6,
                yStart: 433.4,
                maxWidth: 166.5,
                lineHeight: 8,
                fontSize: 10,
                font,
                baselineGab: baselineGab
            });

            // Save PDF and send response
            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            const buyerIdStr = buyerDetails?.customer_citizen_id || 'unknown';
            const dateStr = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : 'date';
            res.setHeader('Content-Disposition', `attachment; filename="order_${dateStr}_${buyerIdStr}.pdf"`);
            res.send(Buffer.from(pdfBytes));

        } catch (error) {
            console.error("ERROR: Unexpected error during PDF generation or download:", error);
            res.status(500).send('An unexpected error occurred during PDF generation.');
        }
    }
}

export const continueOrderPdfController = new ContinueOrderPdfController();
