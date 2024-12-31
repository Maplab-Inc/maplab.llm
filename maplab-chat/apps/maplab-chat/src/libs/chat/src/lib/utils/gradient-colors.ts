export class GradientColors {

  static generateDegradationColors(numColors: number): string[] {
    const initialColor = this.generateRandomDarkColor();
    const initialRGB = this.hexToRgb(initialColor);

    if (!initialRGB) {
      throw new Error("Invalid initial color");
    }

    // Generate the gradient colors (excluding white and black)
    const gradientColors = [];

    for (let i = 0; i < numColors; i++) {
      const factor = i / (numColors - 1);  // Range from 0 to 1

      // Interpolate towards a random target color that is neither white nor black
      const targetRGB = this.generateRandomNonWhiteBlackColor();
      const interpolatedColor = this.interpolateColor(initialRGB, targetRGB, factor);

      gradientColors.push(this.rgbToHex(interpolatedColor.r, interpolatedColor.g, interpolatedColor.b));
    }

    return gradientColors;
  }

  // Convert hex color to RGB
  private static hexToRgb(hex: string) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match ? {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    } : null;
  }

  // Convert RGB to hex
  private static rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  // Interpolate between two colors
  private static interpolateColor(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }, factor: number) {
    const r = Math.round(color1.r + factor * (color2.r - color1.r));
    const g = Math.round(color1.g + factor * (color2.g - color1.g));
    const b = Math.round(color1.b + factor * (color2.b - color1.b));
    return { r, g, b };
  }

  // Generate a random color that is neither too close to white nor black
  private static generateRandomNonWhiteBlackColor(): { r: number; g: number; b: number } {
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
  private static isTooCloseToWhiteOrBlack(r: number, g: number, b: number): boolean {
    const whiteThreshold = 240;
    const blackThreshold = 15;

    // Check if the color is too close to white or black
    return (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) ||
      (r < blackThreshold && g < blackThreshold && b < blackThreshold);
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