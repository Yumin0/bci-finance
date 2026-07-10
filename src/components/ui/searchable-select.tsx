'use client'

import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '請選擇',
  required,
  disabled,
  style,
}: SearchableSelectProps) {
  const [inputText, setInputText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // When value changes externally (e.g. reset), clear search text
  useEffect(() => {
    if (!value) setInputText('')
  }, [value])

  const displayText = isOpen ? inputText : (value || '')
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(inputText.toLowerCase())
  )
  const selectedLabel = options.find(o => o.value === value)?.label ?? value

  function handleSelect(opt: Option) {
    onChange(opt.value)
    setInputText('')
    setIsOpen(false)
  }

  function handleFocus() {
    if (!disabled) {
      setInputText('')
      setIsOpen(true)
    }
  }

  function handleBlur() {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsOpen(false)
        setInputText('')
      }
    }, 150)
  }

  function handleClear() {
    onChange('')
    setInputText('')
    setIsOpen(false)
  }

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 36px 9px 14px',
    border: '1px solid var(--btn-border)',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box',
    background: disabled ? 'var(--bg-page)' : 'var(--bg-card)',
    cursor: disabled ? 'not-allowed' : 'text',
    color: (!isOpen && !value) ? 'var(--text-subtle)' : 'var(--text-body)',
    outline: 'none',
    ...style,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onBlur={handleBlur}>
      <input
        type="text"
        value={isOpen ? inputText : (value ? selectedLabel : '')}
        onChange={e => {
          setInputText(e.target.value)
          setIsOpen(true)
        }}
        onFocus={handleFocus}
        placeholder={isOpen ? '輸入搜尋...' : placeholder}
        required={required && !value}
        disabled={disabled}
        style={baseStyle}
        autoComplete="off"
      />
      {/* Chevron / clear icon */}
      <div style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', pointerEvents: value && !disabled ? 'auto' : 'none',
        cursor: value && !disabled ? 'pointer' : 'default',
      }}>
        {value && !disabled ? (
          <span
            onClick={handleClear}
            style={{ fontSize: 16, color: 'var(--text-subtle)', lineHeight: 1 }}
            title="清除"
          >
            ×
          </span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-muted)' }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          zIndex: 100, maxHeight: 220, overflowY: 'auto',
          color: 'var(--text-body)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-subtle)' }}>無符合選項</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.value}
                onMouseDown={() => handleSelect(o)}
                style={{
                  padding: '8px 12px', fontSize: 14, cursor: 'pointer',
                  background: o.value === value ? 'var(--bg-page)' : 'var(--bg-card)',
                  fontWeight: o.value === value ? 500 : 400,
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg-page)' }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg-card)' }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
