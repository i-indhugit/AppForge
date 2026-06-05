import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'appforge-default-secret-key-change-this-in-production'
);

// Mock database in-memory
// In a real serverless environment, this would be a DB like Supabase, Prisma/Postgres, etc.
// Since we are simulating, we use a global variable that persists during the dev server lifecycle.
const globalUsers = global as any;
if (!globalUsers.users) {
  // Pre-seed with an admin user
  // Password is 'admin123' hashed
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('admin123', salt);
  
  globalUsers.users = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@appforge.ai',
      password: hashedPassword,
      role: 'admin'
    }
  ];
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async createToken(payload: any): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);
  }

  static async verifyToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return payload;
    } catch (error) {
      return null;
    }
  }

  static findUserByEmail(email: string) {
    return globalUsers.users.find((u: any) => u.email === email);
  }

  static addUser(user: any) {
    if (this.findUserByEmail(user.email)) {
      throw new Error('User already exists');
    }
    globalUsers.users.push(user);
    return user;
  }
}
