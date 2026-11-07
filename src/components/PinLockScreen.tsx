import React, { useEffect, useState } from 'react';
import {
  Backspace,
  CheckCircle,
  LockKey,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';
import { api } from '../lib/api.ts';
import { detectPlatformPushInfo } from '../lib/pushClient.ts';

interface PinLockScreenProps {
  pinConfigured: boolean;
  onAuthenticated: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  pinConfigured,
  onAuthenticated,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDigit = (digit: string) => {
    setError(null);
    if (step === 'enter') {
      if (pin.length < 6) setPin((prev) => prev + digit);
    } else {
      if (confirmPin.length < 6) setConfirmPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (step === 'enter') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setError(null);

    const platform = detectPlatformPushInfo();

    if (!pinConfigured) {
      if (step === 'enter') {
        if (pin.length < 4) {
          setError('กรุณาตั้งรหัส PIN อย่างน้อย 4 หลัก (4–6 หลัก)');
          return;
        }
        setStep('confirm');
        return;
      }
      if (pin !== confirmPin) {
        setError('รหัส PIN ยืนยันไม่ตรงกัน กรุณาลองอีกครั้ง');
        setConfirmPin('');
        return;
      }
      setSubmitting(true);
      try {
        await api.setupPin(pin, platform.deviceLabel);
        onAuthenticated();
      } catch (err: unknown) {
        setError((err as Error).message || 'ไม่สามารถตั้งค่า PIN ได้');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (pin.length < 4) {
      setError('กรุณากรอกรหัส PIN 4–6 หลัก');
      return;
    }

    setSubmitting(true);
    try {
      await api.loginPin(pin, platform.deviceLabel);
      onAuthenticated();
    } catch (err: unknown) {
      setError((err as Error).message || 'รหัส PIN ไม่ถูกต้อง');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  // Support physical keyboard input on PC
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (/^\d$/.test(ev.key)) {
        handleDigit(ev.key);
      } else if (ev.key === 'Backspace') {
        handleBackspace();
      } else if (ev.key === 'Enter') {
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const activeValue = step === 'enter' ? pin : confirmPin;

  return (
    <div className="min-h-screen bg-daypulse-mesh flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-4xl shadow-2xl border-2 border-orange-200/70 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4">
            {pinConfigured ? (
              <LockKey size={34} weight="duotone" aria-hidden="true" />
            ) : (
              <ShieldCheck size={34} weight="duotone" aria-hidden="true" />
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200 text-xs font-bold mb-2">
            <Sparkle size={14} weight="fill" aria-hidden="true" />
            <span>DayPulse Personal Sync</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {!pinConfigured
              ? step === 'enter'
                ? 'ตั้งรหัส PIN ส่วนตัวครั้งแรก'
                : 'ยืนยันรหัส PIN อีกครั้ง'
              : 'ปลดล็อกตารางงานของคุณ'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {!pinConfigured
              ? 'ใช้รหัส 4–6 หลักเดียวกันนี้เพื่อเปิดซิงค์งานทั้งบน PC, iPhone และ Android'
              : 'ระบบจะจดจำอุปกรณ์นี้ไว้ให้อัตโนมัติ ไม่ต้องกรอกซ้ำทุกครั้ง'}
          </p>
        </div>

        <form onSubmit={handleSubmit} aria-label="แบบฟอร์มรหัส PIN">
          {/* Accessible hidden password input for password managers & screen readers */}
          <label htmlFor="pin-hidden-input" className="sr-only">
            รหัส PIN ตัวเลข 4 ถึง 6 หลัก
          </label>
          <input
            id="pin-hidden-input"
            type="password"
            inputMode="numeric"
            autoComplete={pinConfigured ? 'current-password' : 'new-password'}
            value={activeValue}
            onChange={(e) => {
              const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
              setError(null);
              if (step === 'enter') setPin(clean);
              else setConfirmPin(clean);
            }}
            className="sr-only"
          />

          {/* PIN Dots Visual Display */}
          <div
            className="flex items-center justify-center gap-3 my-5"
            aria-live="polite"
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const filled = idx < activeValue.length;
              return (
                <div
                  key={idx}
                  className={`w-11 h-12 rounded-2xl border-2 flex items-center justify-center transition-colors ${
                    filled
                      ? 'bg-gradient-to-b from-orange-500 to-rose-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {filled && <span className="w-3 h-3 rounded-full bg-white" />}
                </div>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-center text-sm font-semibold text-rose-700 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          {/* Large Touch-Friendly Keypad */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="min-h-14 rounded-2xl bg-slate-100 hover:bg-orange-100 active:bg-orange-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xl font-extrabold text-slate-900 dark:text-white transition-colors cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (step === 'confirm') {
                  setStep('enter');
                  setConfirmPin('');
                } else {
                  setPin('');
                }
              }}
              className="min-h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {step === 'confirm' ? 'ย้อนกลับ' : 'ล้างค่า'}
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="min-h-14 rounded-2xl bg-slate-100 hover:bg-orange-100 active:bg-orange-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xl font-extrabold text-slate-900 dark:text-white transition-colors cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="ลบตัวเลขล่าสุด"
              className="min-h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Backspace size={24} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || activeValue.length < 4}
            className="w-full min-h-13 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-base shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-opacity cursor-pointer"
          >
            <CheckCircle size={22} weight="bold" aria-hidden="true" />
            <span>
              {submitting
                ? 'กำลังตรวจสอบ...'
                : !pinConfigured
                  ? step === 'enter'
                    ? 'ถัดไป — ยืนยันรหัส PIN'
                    : 'บันทึก PIN และเริ่มใช้งาน'
                  : 'เข้าสู่ตารางงาน'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
