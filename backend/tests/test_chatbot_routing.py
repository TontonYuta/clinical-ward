from app.services.chatbot.router import route_chat_turn
from app.services.chatbot.turn_parser import parse_chat_turn


def test_single_drug_interaction_request_routes_to_partner_clarification():
    parsed = parse_chat_turn("Paracetamol có tương tác không?")
    decision = route_chat_turn(parsed)
    assert decision.route == "clarification"
    assert decision.reason_code == "missing_interaction_partner"


def test_explicit_drug_pair_routes_to_pair_assessment():
    parsed = parse_chat_turn("Warfarin tương tác với amiodaron không?")
    decision = route_chat_turn(parsed)
    assert decision.route == "ddi_pair_assessment"
    assert set(decision.required_entities) == {"warfarin", "amiodaron"}


def test_urgent_post_medication_red_flag_precedes_generic_rag():
    parsed = parse_chat_turn("Bệnh nhân khó thở, phù môi sau tiêm kháng sinh")
    decision = route_chat_turn(parsed)
    assert decision.route == "emergency"
    assert decision.reason_code == "post_medication_red_flag"
