import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, style }) => {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        backgroundColor: '#e11d48',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
        ...style
      }}
    >
      {label}
    </button>
  );
};
