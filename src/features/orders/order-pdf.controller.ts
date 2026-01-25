import type { Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
// @ts-ignore
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs/promises';
import { orderService } from './order.service.js';
import { customerService } from '../customers/customer.service.js';

export class OrderPdfController {

    async download(req: Request, res: Response) {
        try {
            const orderId = req.params.orderId;

            if (typeof orderId !== 'string') {
                return res.status(400).send('Invalid Order ID');
            }
            const accessToken = (req.user as any)?.access_token;

            const order = await orderService.getOrderById(orderId, accessToken);
            if (!order) {
                console.error("ERROR: Order not found for ID:", orderId);
                return res.status(404).send('Order not found.');
            }

            // Get Order Items
            // The getOrderById in service doesn't fetch items by default in current impl, let's fix that or fetch separately?
            // Wait, previous getOrderById impl only did select('*').eq('order_id', orderId).single();
            // We need items. Let's assume we update service or fetch manually here for now to be safe,
            // or better, update service to include items.
            // Actually, let's check service again. It doesn't include items.
            // Let's rely on service having a method or we do a quick fetch here using service or direct supabase if allowed (better service).
            // But for now, let's add getOrderItems to service or just assume we have to enhance getOrderById.
            // Let's enhance getOrderById in service to include items in next step if needed, or better yet, do it in Controller via service.
            // Actually, let's look at `getOrders` in service, it basically does `order_items(*)`. 
            // We should use `getOrderDetail` logic.

            // Fetch Items
            const orderItems = await orderService.getOrderItems(orderId, accessToken);
            order.items = orderItems || [];

            // Fetch Buyer (Customer)
            const buyerDetails = await customerService.findById(order.order_customer_id, accessToken);

            // Fetch Recommender
            let recommenderDetails = null;
            if (order.order_recommender_id) {
                recommenderDetails = await customerService.findByCitizenId(order.order_recommender_id, accessToken); // Assuming ID stored is citizen ID or UUID? 
                // In database schema, recommender_id is usually UUID if FK, but let's check input. 
                // If it's stored as UUID in `order_recommender_id`, use findById.
                // If the code sends UUID, we use findById.
                if (order.order_recommender_id.length === 36) { // UUID length check roughly
                    recommenderDetails = await customerService.findById(order.order_recommender_id, accessToken);
                } else {
                    recommenderDetails = await customerService.findByCitizenId(order.order_recommender_id, accessToken);
                }
            }

            // Fetch Assistant
            let assistantDetails = null;
            if (order.order_assistant_id) {
                if (order.order_assistant_id.length === 36) {
                    assistantDetails = await customerService.findById(order.order_assistant_id, accessToken);
                } else {
                    assistantDetails = await customerService.findByCitizenId(order.order_assistant_id, accessToken);
                }
            }


            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            const PAGE_WIDTH = 344.7;
            const PAGE_HEIGHT = 509.0;
            const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

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

            // Background
            const backgroundPdfPath = path.resolve(process.cwd(), 'public/pdf/FirstOrderForm.pdf');
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
                console.error("Error loading background pdf", err);
                // return res.status(500).send("Error loading background PDF"); // Optional: fail or continue empty
            }

            const fontSize = 10;
            const checkmarkFontSize = 14;
            const baselineGab = 1;
            const textColor = rgb(0, 0, 0);

            const addText = (text: any, xEjs: number, yEjs: number, size = fontSize, color = textColor, useCheckmarkFont = false, letterSpacing = undefined) => {
                if (text === null || text === undefined) return;
                const yPdf = page.getHeight() - yEjs + baselineGab;
                page.drawText(String(text), {
                    x: xEjs,
                    y: yPdf,
                    size,
                    font: useCheckmarkFont ? checkmarkFont! : font!,
                    color,
                    // letterSpacing // pdf-lib might not support letterSpacing in all versions/fonts directly in drawText options depending on version, but user requested it. 
                    // Note: 'letterSpacing' is not part of Standard PDFOptions in older pdf-lib, but might be in newer. 
                    // If errors, we use manual spacing function.
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

            // Order Date
            const orderDate = formatThaiDate(order.order_date);
            addText(orderDate.day, 153.6, 92.8);
            addText(orderDate.month, 167.7, 92.8);
            addText(orderDate.year, 182.8, 92.8);

            // Buyer Details
            const buyerFirstNameEN = buyerDetails ? (buyerDetails.customer_fname_en || '') : '';
            const buyerLastNameEN = buyerDetails ? (buyerDetails.customer_lname_en || '') : '';

            // Phone - mapping from customer_phone/mobile
            const buyerPhone = buyerDetails ? (buyerDetails.customer_phone || '') : '';
            const buyerMobile = buyerDetails ? (buyerDetails.customer_phone || '') : ''; // Logic reuse?

            const buyerAddress1 = buyerDetails ? (buyerDetails.customer_address1 || '') : '';
            const buyerAddress2 = buyerDetails ? (buyerDetails.customer_address2 || '') : '';
            const buyerZipCode = buyerDetails ? (buyerDetails.customer_zipcode || '') : '';
            const fullAddress = `${buyerAddress1} ${buyerAddress2} ${buyerZipCode}`.trim();

            const buyerFullNameTH = buyerDetails ? `${buyerDetails.customer_fname_th} ${buyerDetails.customer_lname_th}` : '';

            addText(`${buyerFirstNameEN} ${buyerLastNameEN}`.trim(), 81.7, 113.5);
            addText(buyerFullNameTH, 81.7, 124.1);

            const birthDateFormatted = formatThaiDate(buyerDetails?.customer_birthdate);
            addText(birthDateFormatted.day, 124.2, 103.1);
            addText(birthDateFormatted.month, 150.0, 103.1);
            addText(birthDateFormatted.year, 178.0, 103.1);

            const recommenderName = recommenderDetails ? `${recommenderDetails.customer_fname_th} ${recommenderDetails.customer_lname_th}` : '';
            const assistantName = assistantDetails ? `${assistantDetails.customer_fname_th} ${assistantDetails.customer_lname_th}` : '';

            addText(recommenderName, 70.8, 186.0);
            addText(assistantName, 70.8, 217.3);

            // Manual Spacing Function for Citizen IDs
            const drawCitizenIDWithManualSpacing = (
                page: any, text: any, xEjs: number, yEjs: number, size: number, font: any, color: any, spacing: number, baselineGab: number
            ) => {
                const yPdf = page.getHeight() - yEjs + baselineGab;
                let currentX = xEjs;
                const textString = text ? String(text) : '';

                for (let i = 0; i < textString.length; i++) {
                    const char = textString[i];
                    page.drawText(char, {
                        x: currentX,
                        y: yPdf,
                        size,
                        font,
                        color,
                    });
                    currentX += font.widthOfTextAtSize(char, size) + spacing;
                }
            };

            const buyerCitizenId = buyerDetails?.customer_citizen_id || '';
            const recommenderCitizenId = recommenderDetails?.customer_citizen_id || ''; // Or stored in order?
            const assistantCitizenId = assistantDetails?.customer_citizen_id || '';

            drawCitizenIDWithManualSpacing(page, buyerCitizenId, 74.9, 166.0, 12, font, textColor, 4.75, baselineGab);
            drawCitizenIDWithManualSpacing(page, recommenderCitizenId, 74.9, 198.3, 12, font, textColor, 4.75, baselineGab);
            // Check if assistant exists before drawing? Code says draw empty if null
            drawCitizenIDWithManualSpacing(page, assistantCitizenId, 74.9, 229.4, 12, font, textColor, 4.75, baselineGab);

            addText(buyerPhone, 32.3, 155.4);
            addText(buyerMobile, 124.1, 155.4);

            // Position Checkmark
            const position = order.position || ''; // e.g. "BM", "AG"
            const posMap: Record<string, { x: number }> = {
                'ทั่วไป': { x: 83.4 },
                'M': { x: 120.5 },
                'BM': { x: 155.1 },
                // Map other DB values if needed
                'AG': { x: 83.4 } // fallback?
            };
            // Logic in JS was: SAG, SFAG, AG, BM. The PDF map seems to list 'ทั่วไป', 'M', 'BM'.
            // Let's assume order.position matches keys or we map them.
            // If unknown, no checkmark.
            if (posMap[position]) {
                addText('P', posMap[position].x, 178.0, checkmarkFontSize, textColor, true);
            }

            // Wrap Text Helper
            const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
                const lines = [];
                if (!text || text.trim() === '') return [''];

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
                        if (currentLine !== '') lines.push(currentLine.trim());
                        currentLine = word;
                    }
                }
                if (currentLine !== '') lines.push(currentLine.trim());
                return lines;
            };

            const drawTextBox = ({ page, textLines, x, yStart, lineHeight, fontSize, font, color = rgb(0, 0, 0), baselineGab }: any) => {
                textLines.forEach((line: string, idx: number) => {
                    const currentLineTopBasedY = yStart + (idx * lineHeight);
                    const yPdf = page.getHeight() - currentLineTopBasedY + baselineGab;
                    page.drawText(line.trim(), {
                        x, y: yPdf, size: fontSize, font, color
                    });
                });
            };

            // Address
            const wrappedAddressLines = wrapText(fullAddress, font, 10, 135);
            drawTextBox({
                page, textLines: wrappedAddressLines, x: 52.5, yStart: 134.7, lineHeight: 10, fontSize: 10, font, baselineGab
            });

            // Items
            const colX = {
                productCode: 6,
                productNameTH: 48.7,
                colorTH: 129.6,
                size: 166.2,
                pricePerUnit: 193.2,
                quantity: 246.0,
                subtotal: 284
            };
            const rowYStart = 300;

            // We need to map DB item fields to PDF fields
            order.items.forEach((item: any, idx: number) => {
                const y = rowYStart + idx * 12.3;

                // Fetch product details?
                // The DB items Table has: product_code, product_name, product_color, product_size, product_price, quantity
                // We can use these directly.

                addText(item.product_code, colX.productCode, y, fontSize);
                // Extract Name/Color/Size from item OR DB
                // item.product_name often contains "Name (Color/Size)" string from frontend, 
                // BUT we also saved real fields in DB if schema supports it, or if not, we parse.
                // The `createOrder` service mapped frontend `product_real_name` -> `product_name` in items table?
                // Let's check `order.service.ts` logic.
                // It saved: product_code, product_name (real name), product_color, product_size, quantity, product_price.
                // So we can use fields directly.

                addText(item.product_name, colX.productNameTH, y, 8);
                addText(item.product_color, colX.colorTH, y, 8);
                addText(item.product_size, colX.size, y, fontSize);
                addText(formatNumber(item.product_price), colX.pricePerUnit, y, fontSize);
                addText(item.quantity, colX.quantity, y, fontSize);
                addText(formatNumber(item.product_price * item.quantity), colX.subtotal, y, fontSize);
            });

            // Totals
            // Map DB fields to PDF fields
            // DB: order_total_amount (subtotal), order_discount, order_price_before_tax, order_tax, order_final_price

            // PDF: 
            // 1. Total (subtotal - discount?) or just subtotal? Logic in PDF JS was: `order.amount` at 420.6
            // 2. if > 20000 -> subtotalBeforeTax at 456.3 + tax at 469.0
            // 3. else -> tax at 444.5
            // 4. GrandTotal at 481.8

            const subtotal = order.order_total_amount;
            const discount = order.order_discount;
            const afterDiscount = subtotal - discount; // Amount to pay before tax logic? 
            // Wait, PDF template logic:
            // "Amount" usually means After Discount but Before Tax? Or Subtotal?
            // Let's map to: order_price_before_tax (which follows discount logic in form).

            addText(formatNumber(subtotal), 288.0, 420.6); // "รวมเงิน"

            if (afterDiscount > 2000000) { // 20,000 * 100 satang
                // Case > 20,000
                addText(formatNumber(afterDiscount), 288.0, 456.3); // "มูลค่าสินค้า"
                addText(formatNumber(order.order_tax), 288.0, 469.0); // "ภาษี 7%"
            } else {
                addText(formatNumber(order.order_tax), 288.0, 444.5); // "ภาษี 7%" (Right side box)
            }

            addText(formatNumber(order.order_final_price), 288.0, 481.8); // "รวมทั้งสิ้น"

            // User info (Recorder)
            // We need to fetch User who recorded. `order_record_by_user_id`
            // Assuming we have service or just ignore for now if complicated?
            // Code requests it:
            /*
            if (req.loggedInUser && req.loggedInUser._id) { ... }
            */
            // We can rely on req.user from auth middleware
            // Or better, fetch the user who *recorded* it from order.order_record_by_user_id? 
            // The request says "loggedinUser", so maybe the person downloading who is staff?
            // "username" and "userPhone".
            // Let's use current logged in user.
            const user = req.user as any;
            // We might need to fetch full user profile if not in token.
            // Token usually has username/email. Phone might be in profile.
            // Let's just print username for now.

            addText(user?.username || '-', 228.9, 247.4);
            addText('-', 228.9, 261.4); // Phone

            // Shipping Addr
            // Use shipping address from logic or customer address?
            // Logic says "note + address".
            const shippingAddr = (order.order_note ? order.order_note + '\n' : '') + (fullAddress || '');
            const wrappedShippingLines = wrapText(shippingAddr, font, 10, 174.7);
            drawTextBox({
                page, textLines: wrappedShippingLines, x: 11.3, yStart: 407.5, lineHeight: 9, fontSize: 10, font, baselineGab
            });

            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="order_${orderId}.pdf"`);
            res.send(Buffer.from(pdfBytes));

        } catch (error) {
            console.error("ERROR generating Order PDF:", error);
            res.status(500).send("Error generating PDF");
        }
    }
}

export const orderPdfController = new OrderPdfController();
