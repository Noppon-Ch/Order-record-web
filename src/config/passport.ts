import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LineStrategy } from 'passport-line-auth';
import dotenv from 'dotenv';

dotenv.config();

// 1. Serialize & Deserialize User
// หน้าที่: ยัดข้อมูล User ลง Session (Serialize) และดึงออกมาใช้ (Deserialize)
// หมายเหตุ: ในงานจริง ตรงนี้เราจะ Save ลง Database แล้วเก็บแค่ user.id ลง Session ครับ
passport.serializeUser((user: any, done) => {
    done(null, user);
});

passport.deserializeUser((user: any, done) => {
    done(null, user);
});

// 2. Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackURL: process.env.GOOGLE_CALLBACK_URL as string
}, (accessToken, refreshToken, profile, done) => {
    // ตรงนี้คือจุดที่ Google ส่งข้อมูล User กลับมา
    console.log('Google Profile:', profile.displayName);

    // TODO: ตรงนี้ต้องเขียนโค้ด เช็คว่ามี User ใน Database ไหม? ถ้าไม่มีให้สร้างใหม่ (Register)
    // สำหรับตอนนี้ ส่ง profile ผ่านไปก่อน
    const user = { ...profile, access_token: accessToken };
    return done(null, user);
}));

// 3. LINE Strategy
// Removed LINE Strategy

export default passport;