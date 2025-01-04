export class GradientColors {
  static colorPalette: string[] = [
    '#1e90ff',
    '#caff70',
    '#20b2aa',
    '#40e0d0',
    '#104e8b',
    '#ff6347',
    '#ffb90f',
    '#d2691e',
    '#00688b',
    '#cd7054',
    '#c1ffc1',
    '#ee82ee',
    '#ff00ff',
    '#eeee00',
    '#ffa500',
    '#dc143c',
    '#458b00',
    '#ff4500',
    '#6495ed',
    '#76eec6',
    '#607b8b',
    '#6a5acd',
    '#8a2be2',
    '#00ff00',
    '#87ceeb',
    '#4169e1',
    '#698b69',
    '#7ac5cd',
    '#a2cd5a',
    '#e0eeee',
    '#53868b',
    '#8b3e2f',
    '#8b8378',
    '#6b8e23',
    '#ff1493',
    '#00008b',
    '#ee3b3b',
    '#c1cdcd',
    '#00bfff',
    '#9370db',
    '#00cdcd',
    '#7fffd4',
    '#00ffff',
    '#32cd32',
    '#cdc0b0',
    '#00b2ee',
    '#cdb5cd',
    '#838b8b',
    '#cd1076',
    '#8fbc8f',
    '#e9967a',
    '#afeeee',
    '#cd4f39',
    '#006400',
    '#ff7f24',
    '#458b74',
    '#483d8b',
    '#8b6914',
    '#87cefa',
    '#1c86ee',
    '#66cdaa',
    '#b3ee3a',
    '#3cb371',
    '#ffe1ff',
    '#ff69b4',
    '#ba55d3',
    '#ffd700',
    '#c71585',
    '#dda0dd',
    '#008b8b',
    '#76ee00',
    '#48d1cc',
    '#9acd32',
    '#20b2aa',
    '#00fa9a',
    '#2f4f4f',
    '#4682b4',
    '#add8e6',
    '#8b0000',
    '#551a8b',
    '#2e8b57',
    '#bf3eff',
    '#6495ed',
    '#800080',
  ];

  static generateDegradationColors(colorsCount: number): string[] {
    if (colorsCount <= 0) {
      return [];
    }

    const shuffled = [...this.colorPalette].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(colorsCount, this.colorPalette.length));
  }

  // Convert hex color to RGB
  private static hexToRgb(hex: string) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match
      ? {
          r: parseInt(match[1], 16),
          g: parseInt(match[2], 16),
          b: parseInt(match[3], 16),
        }
      : null;
  }

  // Convert RGB to hex
  private static rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    );
  }

  // Interpolate between two colors
  private static interpolateColor(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number },
    factor: number
  ) {
    const r = Math.round(color1.r + factor * (color2.r - color1.r));
    const g = Math.round(color1.g + factor * (color2.g - color1.g));
    const b = Math.round(color1.b + factor * (color2.b - color1.b));
    return { r, g, b };
  }

  // Generate a random color that is neither too close to white nor black
  private static generateRandomNonWhiteBlackColor(): {
    r: number;
    g: number;
    b: number;
  } {
    let r, g, b;
    do {
      r = this.getRandomColorValue();
      g = this.getRandomColorValue();
      b = this.getRandomColorValue();
    } while (this.isTooCloseToWhiteOrBlack(r, g, b));

    return { r, g, b };
  }

  // Generate a random color value between 15 and 240 to avoid black and white
  private static getRandomColorValue(): number {
    return Math.floor(Math.random() * (240 - 15 + 1)) + 15;
  }

  // Check if a color is too close to white or black
  private static isTooCloseToWhiteOrBlack(
    r: number,
    g: number,
    b: number
  ): boolean {
    const whiteThreshold = 240;
    const blackThreshold = 15;

    // Check if the color is too close to white or black
    return (
      (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) ||
      (r < blackThreshold && g < blackThreshold && b < blackThreshold)
    );
  }

  private static generateRandomDarkColor(): string {
    let r, g, b;

    do {
      // Generate RGB values with a low range to ensure a dark color, but not black
      r = this.getRandomDarkValue();
      g = this.getRandomDarkValue();
      b = this.getRandomDarkValue();
    } while (r < 10 && g < 10 && b < 10); // Avoid pure black

    return this.rgbToHex(r, g, b);
  }

  private static getRandomDarkValue(): number {
    return Math.floor(Math.random() * 101); // Random number between 0 and 100
  }
}
