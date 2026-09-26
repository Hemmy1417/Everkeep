"""Evidence: who may file, what is stored and hashed, what a round is allowed
to read, and what is shown as a claim and never read."""
import json

import pytest

from conftest import (FOUNDER, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_,
                      declaration, document, err, exif_jpeg, image, jfif, order, png, reference,
                      set_now)


def test_image_is_stored_and_hashed_by_the_contract(module, c):
    oid, aid, wid = active_order(module, c)
    data = jfif(b"north")
    eid = image(module, c, wid, data=data)
    it = json.loads(c.get_item(eid))
    assert it["kind"] == "IMAGE" and it["role"] == "PROVIDER" and it["bytes"] == len(data)
    assert it["sha256"] == __import__("hashlib").sha256(data).hexdigest()
    assert bytes(c.get_image(eid)) == data
    assert it["filed_by"] == PROVIDER and it["criterion_id"] == "C1"


def test_png_accepted_exif_jpeg_refused_and_size_capped(module, c):
    oid, aid, wid = active_order(module, c)
    image(module, c, wid, data=png(b"x"))
    with pytest.raises(err(module), match="PNG and JFIF"):
        image(module, c, wid, data=exif_jpeg())
    with pytest.raises(err(module), match="at most 400,000 bytes"):
        image(module, c, wid, data=jfif(size=400_001))
    with pytest.raises(err(module), match="empty"):
        image(module, c, wid, data=b"")


def test_only_parties_file_and_the_inspector_must_have_accepted(module, c):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid, inspector=INSPECTOR)
    wid = create_order(module, c, aid)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 1)
    with pytest.raises(err(module), match="only a steward, the provider"):
        image(module, c, wid, who=STRANGER)
    with pytest.raises(err(module), match="only a steward, the provider"):
        image(module, c, wid, who=INSPECTOR)
    as_(module, INSPECTOR)
    c.accept_inspector_role(aid)
    eid = image(module, c, wid, who=INSPECTOR)
    assert json.loads(c.get_item(eid))["role"] == "INSPECTOR"
    eid = image(module, c, wid, who=STEWARD2)
    assert json.loads(c.get_item(eid))["role"] == "STEWARD"


def test_nothing_is_filed_before_the_provider_signs(module, c):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    with pytest.raises(err(module), match="not signed the terms"):
        image(module, c, wid)


def test_meta_must_name_criteria_that_exist(module, c):
    oid, aid, wid = active_order(module, c)
    with pytest.raises(err(module), match="no acceptance criterion C9"):
        image(module, c, wid, crit="C9")
    with pytest.raises(err(module), match="must be JSON"):
        as_(module, PROVIDER)
        c.submit_image(wid, "{", jfif())
    with pytest.raises(err(module), match="photograph, a nameplate, a meter display"):
        image(module, c, wid, origin="HOLOGRAM")


def test_document_types_and_the_inspection_report_gate(module, c):
    oid, aid, wid = active_order(module, c, inspector=INSPECTOR)
    with pytest.raises(err(module), match="only the asset's accepted inspector files an inspection report"):
        document(module, c, wid, doc_type="INSPECTION_REPORT")
    with pytest.raises(err(module), match="document type must be one of"):
        document(module, c, wid, doc_type="POEM")
    eid = document(module, c, wid, who=INSPECTOR, doc_type="INSPECTION_REPORT",
                   text="Inspected 24 Sep: new 6 kW inverter fitted, isolators labelled, array producing 4.1 kW.")
    it = json.loads(c.get_item(eid))
    assert it["doc_type"] == "INSPECTION_REPORT" and it["role"] == "INSPECTOR"
    assert c.get_item_text(eid).startswith("Inspected 24 Sep")


def test_document_empty_or_too_long_is_refused(module, c):
    oid, aid, wid = active_order(module, c)
    with pytest.raises(err(module), match="empty"):
        document(module, c, wid, text="   ")
    with pytest.raises(err(module), match="at most 6,000"):
        document(module, c, wid, text="x" * 6001)


def test_declaration_is_stored_and_flagged_unread(module, c):
    oid, aid, wid = active_order(module, c)
    as_(module, PROVIDER)
    out = json.loads(c.submit_declaration(wid, "The work is complete."))
    assert out["read_by_rounds"] is False
    assert c.get_item_text(out["item_id"]) == "The work is complete."


def test_reference_is_a_claim_with_url_and_digest_never_fetched(module, c):
    oid, aid, wid = active_order(module, c)
    eid = reference(module, c, wid)
    it = json.loads(c.get_item(eid))
    assert it["kind"] == "REFERENCE" and it["url"].startswith("https://")
    assert it["claimed_sha256"] == "a" * 64 and it["reference_type"] == "VIDEO_REFERENCE"
    with pytest.raises(err(module), match="carries no text"):
        c.get_item_text(eid)
    with pytest.raises(err(module), match="http or https"):
        reference(module, c, wid, url="ftp://x")
    with pytest.raises(err(module), match="64 hexadecimal"):
        reference(module, c, wid, claimed_sha256="zz")
    src = open(module.__file__, encoding="utf-8").read()
    assert "gl.nondet.web" not in src, "no round fetches anything"


def test_quotas_per_role_and_bucket(module, c):
    oid, aid, wid = active_order(module, c)
    for _ in range(12):
        image(module, c, wid)
    with pytest.raises(err(module), match="filed the 12 images"):
        image(module, c, wid)
    for _ in range(3):
        document(module, c, wid, who=STEWARD2)
    with pytest.raises(err(module), match="filed the 3 documents, declarations and references"):
        declaration(module, c, wid, who=STEWARD2)


def test_filing_stops_at_the_deadline(module, c):
    oid, aid, wid = active_order(module, c)
    set_now("2026-10-20T12:00:01Z")
    with pytest.raises(err(module), match="deadline has passed"):
        image(module, c, wid)


def test_evidence_view_groups_by_version(module, c):
    oid, aid, wid = active_order(module, c)
    e1 = image(module, c, wid)
    w = order(c, wid)
    assert [it["item_id"] for it in w["evidence"]["1"]] == [e1]
    assert w["now"] == "2026-09-20T09:00:00Z"
