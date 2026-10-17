import math

DELTA_H = 83144.0  # J/mol (WHO standard for vaccines & biologics)
GAS_CONSTANT_R = 8.3144  # J/(mol * K)

def calculate_mkt(temperatures_celsius: list[float]) -> float:
    """
    Calculate Mean Kinetic Temperature (MKT) according to WHO PQS & Arrhenius formula.
    """
    if not temperatures_celsius:
        return 5.0

    n = len(temperatures_celsius)
    exp_sum = 0.0

    for t_c in temperatures_celsius:
        t_kelvin = t_c + 273.15
        if t_kelvin <= 0:
            continue
        exp_sum += math.exp(-DELTA_H / (GAS_CONSTANT_R * t_kelvin))

    mean_exp = exp_sum / n
    if mean_exp <= 0:
        return sum(temperatures_celsius) / n

    mkt_kelvin = (DELTA_H / GAS_CONSTANT_R) / (-math.log(mean_exp))
    mkt_celsius = mkt_kelvin - 273.15
    return round(mkt_celsius, 2)
