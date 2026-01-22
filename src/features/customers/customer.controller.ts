import type { Request, Response } from 'express';
import { customerService } from './customer.service.js';
import type { CreateCustomerDTO } from './customer.types.js';

export class CustomerController {
	async showAddForm(req: Request, res: Response) {
		const user = req.user;
		res.render('add', { user, error: null, values: {} });
	}

	async addCustomer(req: Request, res: Response) {
		// Map form fields to DB fields, allow zipcode and consent to be null
		const body = req.body;
		const values: CreateCustomerDTO = {
			customer_citizen_id: body.citizenID,
			customer_fname_th: body.firstNameTH,
			customer_lname_th: body.lastNameTH,
			customer_fname_en: body.firstNameEN || undefined,
			customer_lname_en: body.lastNameEN || undefined,
			customer_gender: body.gender,
			customer_nationality: body.nationality,
			customer_tax_id: body.taxID || undefined,
			customer_phone: body.mobile,
			customer_birthdate: body.birthDate,
			customer_registerdate: body.registerDate,
			customer_address1: body.addressLine1,
			customer_address2: body.addressFullLocate,
			customer_zipcode: body.zipCode || undefined,
			customer_position: body.position,
			customer_consent_status: false, // PDPA ยังไม่บันทึกจริง
			customer_recommender_id: '', // เปลี่ยนจาก undefined เป็น empty string
			customer_record_by_user_id: '', // เปลี่ยนจาก undefined เป็น empty string
		};
		try {
			// Minimal: ไม่เช็คซ้ำ citizen id, แค่ insert
			await customerService.createCustomer(values);
			return res.redirect('/customers');
		} catch (err: any) {
			return res.status(400).render('add', {
				error: err.message || 'Failed to add customer.',
				values
			});
		}
	}
}

export const customerController = new CustomerController();
