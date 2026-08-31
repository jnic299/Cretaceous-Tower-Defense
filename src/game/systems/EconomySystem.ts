/**
 * Match-scoped Supply. Deliberately tiny — the value of keeping it separate is
 * that every earn and every spend passes through one place, so the end-of-match
 * report and the HUD can never drift apart.
 */
export class EconomySystem {
  private _supply: number;
  private _earned = 0;
  private _spent = 0;
  private _grossSpent = 0;

  constructor(starting: number) {
    this._supply = starting;
    this._earned = starting;
  }

  get supply(): number {
    return Math.floor(this._supply);
  }

  get earned(): number {
    return Math.floor(this._earned);
  }

  /** Supply currently committed to standing placements. Refunds reduce it. */
  get spent(): number {
    return Math.floor(this._spent);
  }

  /**
   * Every Supply the player ever committed this match. Selling a unit hands
   * the Supply back but does not un-spend it, so this is what the lifetime
   * statistic is built from.
   */
  get grossSpent(): number {
    return Math.floor(this._grossSpent);
  }

  canAfford(cost: number): boolean {
    return this._supply >= cost;
  }

  add(amount: number): void {
    if (amount <= 0) return;
    this._supply += amount;
    this._earned += amount;
  }

  spend(amount: number): boolean {
    if (this._supply < amount) return false;
    this._supply -= amount;
    this._spent += amount;
    this._grossSpent += amount;
    return true;
  }

  /** Refunds go back without inflating the "earned" figure. */
  refund(amount: number): void {
    this._supply += amount;
    this._spent = Math.max(0, this._spent - amount);
  }
}
