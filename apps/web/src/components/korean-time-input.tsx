"use client";

import { useMemo, useState } from "react";

type KoreanTimeInputProps = {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
};

type TimeParts = {
  period: "" | "AM" | "PM";
  hour: string;
  minute: string;
};

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parseTime(value?: string): TimeParts {
  if (!value) return { period: "", hour: "", minute: "" };

  const [rawHour, rawMinute] = value.split(":");
  const hour24 = Number(rawHour);
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23 || !rawMinute) {
    return { period: "", hour: "", minute: "" };
  }

  return {
    period: hour24 < 12 ? "AM" : "PM",
    hour: String(hour24 % 12 || 12).padStart(2, "0"),
    minute: rawMinute.padStart(2, "0").slice(0, 2)
  };
}

function toTimeValue(parts: TimeParts) {
  if (!parts.period || !parts.hour || !parts.minute) return "";

  const hour12 = Number(parts.hour);
  const hour24 = parts.period === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(hour24).padStart(2, "0")}:${parts.minute}`;
}

export function KoreanTimeInput({ name, label, defaultValue, required = false }: KoreanTimeInputProps) {
  const initialValue = useMemo(() => parseTime(defaultValue), [defaultValue]);
  const [parts, setParts] = useState<TimeParts>(initialValue);
  const timeValue = toTimeValue(parts);

  return (
    <label className="form-control">
      <span className="label-text">{label}</span>
      <input type="hidden" name={name} value={timeValue} />
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <select
          name={`${name}Period`}
          aria-label={`${label} 오전/오후`}
          className="select select-bordered min-w-0"
          required={required}
          value={parts.period}
          onChange={(event) => setParts((current) => ({ ...current, period: event.target.value as TimeParts["period"] }))}
        >
          <option value="" disabled={required}>
            선택
          </option>
          <option value="AM">오전</option>
          <option value="PM">오후</option>
        </select>
        <select
          name={`${name}Hour`}
          aria-label={`${label} 시`}
          className="select select-bordered min-w-0"
          required={required}
          value={parts.hour}
          onChange={(event) => setParts((current) => ({ ...current, hour: event.target.value }))}
        >
          <option value="" disabled={required}>
            시
          </option>
          {hours.map((hour) => (
            <option key={hour} value={hour}>
              {hour}시
            </option>
          ))}
        </select>
        <select
          name={`${name}Minute`}
          aria-label={`${label} 분`}
          className="select select-bordered min-w-0"
          required={required}
          value={parts.minute}
          onChange={(event) => setParts((current) => ({ ...current, minute: event.target.value }))}
        >
          <option value="" disabled={required}>
            분
          </option>
          {minutes.map((minute) => (
            <option key={minute} value={minute}>
              {minute}분
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
