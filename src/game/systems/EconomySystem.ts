/**
 * Match-scoped Supply. Deliberately tiny — the value of keeping it separate is
 * that every earn and every spend passes through one place, so the end-of-match
 * report and the HUD can never drift apart.
 */
export class EconomySystem {
  private _supply: number;
  private _earned = 0;
  private _spent = 0;

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

  get spent(): number {
    return Math.floor(this._spent);
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
    return true;
  }

  /** Refunds go back without inflating the "earned" figure. */
  refund(amount: number): void {
    this._supply += amount;
    this._spent = Math.max(0, this._spent - amount);
  }
}
