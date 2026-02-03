1. กรณี user ไม่สังกัด team ต้องการให้ 
1.1 customer table: user สามารถ select insert update delete ข้อมูลที่ user ลงข้อมูลเองได้ (customer_record_by_user_id = user_id uuid) 
1.2 order table: user สามารถ select insert delete ข้อมูลที่ user ลงข้อมูลเองได้ (order_record_by_user_id = user_id uuid)

2. กรณีที่ user สังกัต team ต้องการให้ 
2.1 customer table: leader สามารถ select insert update delete, co-leader & member สามารถ select insert update ข้อมูลที่ถูกบันทึกโดยทีมได้ (customer_record_by_team_id = team_id uuid) 2.2 order table: 
2.2.1 leader สามารถ select insert delete ข้อมูลที่ถูกบันทึกโดยทีมได้ (order_record_by_team_id = team_id uuid) 
2.2.2 co-leader สามารถ select insert ข้อมูลที่ถูกบันทึกโดยทีมได้ (order_record_by_team_id = team_id uuid) 
2.2.3 member สามารถ select insert delete ข้อมูลที่ถูกบันทึกโดย user และใน team เท่านั้น (order_record_by_user_id = user_id uuid & order_record_by_team_id = team_id uuid)