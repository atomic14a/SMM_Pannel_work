'use client';

import { useState, useRef, useEffect } from 'react';

export default function PinModal({ isOpen, onSuccess, expectedPin = '1234' }) {
    const [pin, setPin] = useState(['', '', '', '']);
    const [error, setError] = useState(false);
    const inputs = useRef([]);

    useEffect(() => {
        if (isOpen && inputs.current[0]) {
            inputs.current[0].focus();
        }
    }, [isOpen]);

    const handleChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        // restrict to numbers only
        if (value && !/^\d+$/.test(value)) return;

        const newPin = [...pin];
        newPin[index] = value;
        setPin(newPin);
        setError(false);

        // Auto-focus next input
        if (value && index < 3) {
            inputs.current[index + 1].focus();
        }

        // Check PIN when all filled
        if (index === 3 && value && newPin.every(d => d !== '')) {
            const enteredPin = newPin.join('');
            // In a real app we'd verify this server side, but this is an internal panel
            // checking against the env var or state
            if (enteredPin === expectedPin) {
                onSuccess();
            } else {
                setError(true);
                setTimeout(() => {
                    setPin(['', '', '', '']);
                    inputs.current[0].focus();
                }, 500);
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '400px' }}>
                <div className="text-center">
                    <div className="empty-state-icon" style={{ opacity: 1, marginBottom: '0' }}>🔒</div>
                    <h2 className="modal-title">Admin Access Required</h2>
                    <p className="modal-desc">Enter your 4-digit PIN to access API settings.</p>

                    <div className="pin-input-group">
                        {pin.map((digit, i) => (
                            <input
                                key={i}
                                type="password"
                                className="pin-digit"
                                value={digit}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                ref={el => inputs.current[i] = el}
                                maxLength={1}
                                autoFocus={i === 0}
                            />
                        ))}
                    </div>

                    {error && <div className="pin-error">Incorrect PIN</div>}
                </div>
            </div>
        </div>
    );
}
