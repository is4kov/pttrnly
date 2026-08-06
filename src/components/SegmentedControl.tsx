import styled from 'styled-components';

const Fieldset = styled.fieldset`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm}px;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
`;

const Legend = styled.legend`
  float: left;
  margin-right: ${({ theme }) => theme.space.sm}px;
  padding: 0;
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Options = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
`;

const Option = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.md}px;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: 0.8125rem;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textMuted};

  &:has(input:checked) {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
  }

  &:has(input:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }

  input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
`;

type Props<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

/** Radio group styled as segments. Radios keep arrow-key navigation for free. */
export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  labels,
  onChange,
}: Props<T>) {
  return (
    <Fieldset>
      <Legend>{legend}</Legend>
      <Options>
        {options.map((option) => (
          <Option key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => {
                onChange(option);
              }}
            />
            {labels?.[option] ?? option}
          </Option>
        ))}
      </Options>
    </Fieldset>
  );
}
