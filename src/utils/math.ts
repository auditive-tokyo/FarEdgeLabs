/**
 * @fileoverview Utility function to transform a value from one range to another
 * Takes a value and maps it from its original min/max range to a new min/max range
 * Clamps the input value to the original range before transforming
 */
export const transformRange = (
  value: number,
  min: number,
  max: number,
  newMin: number,
  newMax: number,
) => {
  const normalized = (Math.min(Math.max(value, min), max) - min) / (max - min);
  return newMin + normalized * (newMax - newMin);
};

/**
 * @fileoverview Linear interpolation (lerp) function for smooth transitions
 * Calculates intermediate value between start and end based on interpolation factor
 * Commonly used for animations and gradual value changes
 * @param start Starting value
 * @param end Ending value
 * @param t Interpolation factor (0-1)
 * @returns Interpolated value
 */
export const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};

/**
 * @fileoverview Debounce utility to limit how often a function can be called
 * Creates a debounced version of the provided function that delays execution
 * Useful for handling frequent events like resize or scroll
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number,
): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  }) as T;
};

/**
 * @fileoverview Interpolation utility for transitioning between object states
 * Takes a start object and end object with numeric or unit-based values (e.g. '10px', 'rotate(45deg)')
 * Interpolates between corresponding properties based on a progress value (0-1)
 * Handles CSS units and transform functions while maintaining correct formatting
 * Returns an object with interpolated values in their original format
 */
export const interpolate = (
  start: { [key: string]: any },
  end: { [key: string]: any },
  progress: number,
) => {
  const result: { [key: string]: any } = {};

  // Helper to extract number from string with units
  const extractNumber = (
    value: any,
  ): { number: number; unit: string | null } => {
    if (typeof value === "number") return { number: value, unit: null };
    if (typeof value === "string") {
      // Handle CSS transform functions like translate(10px) or rotate(45deg)
      //
      // 単位を `[a-zA-Z%]` に絞っているのは意図的。以前は `[^)]*` で、直前の
      // `[-0-9.]+` と文字集合が重なっていた。"10.5" をどこで切るかが何通りにもなり、
      // **入力長に対して非線形に遅くなる**（Sonar S8786）。単位は英字か % しか
      // 取らないので、そう書けば曖昧さが消える。広げ直さないこと。
      //
      // **引数が複数の transform は元から扱えていない。** `translate(10px, 20px)` は
      // 以前も unit が `"translate(px, 20px)"` という無意味な文字列になっていた。
      // 絞ったことで結果は変わるが、どちらも壊れている。**単引数専用**と思うこと。
      const functionMatch = /^([a-zA-Z]+)\(([-0-9.]+)([a-zA-Z%]*)\)$/.exec(value);
      if (functionMatch) {
        return {
          number: Number.parseFloat(functionMatch[2]),
          unit: `${functionMatch[1]}(${functionMatch[3]})`,
        };
      }
      // Handle regular values with units like 45deg or 100px
      //
      // **効いているのはアンカー。** 文字集合の重なりを消しただけでは足りなかった。
      // アンカーが無いと全開始位置から試すので、`"1.1.1..."` のような入力で
      // 「末尾まで食べて戻る」を開始位置の数だけ繰り返し、二次になる。
      // 実測（n=8000、長さ4倍あたりの伸び）:
      //   アンカー無し `([-0-9.]+)([a-zA-Z%]+)`        29.9ms  x14.4  二次
      //   両端アンカー `^([-0-9.]+)([a-zA-Z%]+)$`       0.008ms  x4.1  線形
      //
      // > [!warning] `\d*\.?\d+` へ「厳密化」しないこと
      // > もっともらしいが**二次に戻る**（実測 27.8ms / x15.9）。`\d*` と `\d+` の
      // > 切り分けが n 通りあり、それぞれが戻るので組み合わせが二乗になる。
      // > アンカー + 重ならない文字集合 + 各グループ1つの貪欲、が線形の条件。
      //
      // アンカーを付けたことで `"10px solid"` のような**値に埋もれた形**は外れるが、
      // ここに来るのは単一の CSS 値なので該当しない。`.5rem` は従来どおり通る。
      const match = /^([-0-9.]+)([a-zA-Z%]+)$/.exec(value);
      if (match) {
        return {
          number: Number.parseFloat(match[1]),
          unit: match[2],
        };
      }
    }
    return { number: 0, unit: null };
  };

  // Interpolate each property in the objects
  for (const key in start) {
    const startVal = extractNumber(start[key]);
    const endVal = extractNumber(end[key]);

    if (startVal.unit !== null || endVal.unit !== null) {
      const unit = startVal.unit || endVal.unit;
      if (unit?.includes("(")) {
        // Check if it's any CSS transform function
        result[key] =
          `${unit.split("(")[0]}(${lerp(startVal.number, endVal.number, progress)}${unit.split(")")[0].slice(unit.split("(")[0].length)})`;
      } else {
        result[key] =
          `${lerp(startVal.number, endVal.number, progress)}${unit}`;
      }
    } else {
      result[key] = lerp(startVal.number, endVal.number, progress);
    }
  }

  return result;
};
