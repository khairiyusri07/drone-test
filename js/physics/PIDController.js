export class PIDController {
    constructor(kp = 4.5, ki = 0.05, kd = 1.2) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;

        this.integral = 0;
        this.previousError = 0;
        this.maxIntegral = 10.0;
    }

    reset() {
        this.integral = 0;
        this.previousError = 0;
    }

    update(targetValue, currentValue, delta) {
        if (delta <= 0) return 0;

        const error = targetValue - currentValue;

        // Proportional Term
        const pTerm = this.kp * error;

        // Integral Term with anti-windup clamping
        this.integral += error * delta;
        this.integral = Math.max(-this.maxIntegral, Math.min(this.maxIntegral, this.integral));
        const iTerm = this.ki * this.integral;

        // Derivative Term
        const derivative = (error - this.previousError) / delta;
        const dTerm = this.kd * derivative;

        this.previousError = error;

        return pTerm + iTerm + dTerm;
    }
}
