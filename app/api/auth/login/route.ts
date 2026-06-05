import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // 1. Basic Validation
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Missing email or password' }, { status: 400 });
    }

    // 2. Find User
    const user = AuthService.findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Verify Password
    const isValid = await AuthService.comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // 4. Generate Signed JWT
    const token = await AuthService.createToken({ 
      sub: user.id,
      email: user.email, 
      role: user.role 
    });

    return NextResponse.json({ 
      success: true, 
      token, 
      user: { 
        name: user.name,
        email: user.email, 
        role: user.role 
      } 
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: message || 'Login failed' }, { status: 500 });
  }
}
