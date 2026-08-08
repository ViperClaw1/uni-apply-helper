declare module "react-phone-input-2" {
  import type { ComponentType, CSSProperties } from "react";

  export interface PhoneInputProps {
    country?: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    inputClass?: string;
    buttonClass?: string;
    dropdownClass?: string;
    containerClass?: string;
    inputStyle?: CSSProperties;
    buttonStyle?: CSSProperties;
    containerStyle?: CSSProperties;
    specialLabel?: string;
  }

  const PhoneInput: ComponentType<PhoneInputProps>;
  export default PhoneInput;
}
