import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. Basic Validation
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // 2. Password Complexity Check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.' 
      }, { status: 400 });
    }

    // 3. Hash Password
    const hashedPassword = await AuthService.hashPassword(password);

    // 4. Create User
    const newUser = {
      id: randomUUID(),
      name,
      email,
      password: hashedPassword,
      role: 'user'
    };

    try {
      AuthService.addUser(newUser);
    } catch (err: any) {
      if (err.message === 'User already exists') {
        return NextResponse.json({ success: false, message: 'User already exists' }, { status: 409 });
      }
      throw err;
    }

    // 5. Generate Signed JWT
    const token = await AuthService.createToken({ 
      sub: newUser.id,
      email: newUser.email, 
      role: newUser.role 
    });

    return NextResponse.json({ 
      success: true, 
      token, 
      user: { 
        name: newUser.name,
        email: newUser.email, 
        role: newUser.role 
      } 
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: message || 'Registration failed' }, { status: 500 });
  }
}
