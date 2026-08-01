/** Title Case: "IANA VEDERNIKOVA" → "Iana Vedernikova", "АЛТАЙСКИЙ КРАЙ" → "Алтайский Край" */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) {
        return word;
      }

      const lower = word.toLocaleLowerCase("ru-RU");

      return lower.charAt(0).toLocaleUpperCase("ru-RU") + lower.slice(1);
    })
    .join(" ");
}
