"""Direct-mode harness for EVERKEEP: the real contract module against a stub
`genlayer` that is as strict as the runtime where it matters.

  VALIDATORS RUN. `gl.vm.run_nondet` runs the leader, then the validator
  closure on the leader's result; a validator returning False fails the
  round with nothing written, like the network.

  THE MODEL. `exec_prompt` answers from per-role queues, one for image
  prompts ("look") and one for criteria prompts ("judge"), so a test can make
  the leader and the validator read the same evidence differently. It also
  enforces GenVM's image rules measured in docs/PROBE-REPORT: at most two
  images, each at most 5 MB, PNG or JFIF-headed JPEG only.

  THE CLOCK. `set_now(iso)` sets the transaction datetime; nothing advances
  on its own, so both sides of every deadline and window are testable.

  MONEY. `pay(who, wei)` sets the transaction value; `_Payee.emit_transfer`
  appends to `transfers()`. A public write that raises reverts every tree,
  like the runtime, so a refusal can never leave half a state behind.
"""

import importlib.util
import json
import os
import pathlib
import sys
import types
from datetime import datetime, timezone

import pytest
from eth_utils import to_checksum_address

CONTRACT_PATH = (pathlib.Path(__file__).resolve().parents[2]
                 / "contracts" / "everkeep.py")

# EIP-55 checksummed, the form the contract records signers in.
FOUNDER = to_checksum_address("0x691e25a08e00fa16fc95b159589ba563727d77a8")
STEWARD2 = to_checksum_address("0x7a1b2c3d4e5f60718293a4b5c6d7e8f901234567")
PROVIDER = to_checksum_address("0x56e71175c0772a21a6170e3d95184f126526e9f2")
INSPECTOR = to_checksum_address("0x69730962ce945c8da10817a6ae53fbaff7675531")
STRANGER = to_checksum_address("0xd41fca7210904c6d2f4e00c377e76f8aad43ec9e")
DEPLOYER = to_checksum_address("0x26ed19d786db6c920d0969b2d8a25f6a0fc8e338")

GEN = 10**18

_ROLE = ["leader"]
_ANSWERS = {"look": {"leader": [], "validator": []}, "judge": {"leader": [], "validator": []}}
_CALLS = {"look": {"leader": 0, "validator": 0}, "judge": {"leader": 0, "validator": 0}}
_PROMPTS = []
_FORGED = []
_ACCEPTED = []
_PRINTS = []
_TRANSFERS = []
_NOW = [datetime(2026, 9, 20, 9, 0, 0, tzinfo=timezone.utc)]


class _NoAnswer(BaseException):
    """A test forgot to queue a model answer. BaseException, so the
    contract's per-image isolation cannot swallow a harness mistake."""


class _UserError(Exception):
    def __init__(self, data):
        super().__init__(data)
        self.data = data

    def __str__(self):
        return str(self.data)


class _VMError:
    def __init__(self, message):
        self.message = message


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


def _roundtrip(value):
    """Consensus serializes the leader's result; round-tripping enforces
    that everything returned is plain data."""
    return json.loads(json.dumps(value))


def _run_nondet(leader_fn, validator_fn):
    if _ACCEPTED:
        # A result the network accepted whatever it says: tests the contract's
        # own boundary checks, the layer behind the validators.
        return _ACCEPTED.pop(0)
    if _FORGED:
        forged = _FORGED.pop(0)
        _ROLE[0] = "validator"
        try:
            ok = validator_fn(_Return(forged))
        except Exception:
            ok = False
        finally:
            _ROLE[0] = "leader"
        if not ok:
            raise _UserError("[LLM_ERROR] validators did not agree with the leader")
        return forged
    try:
        value = _roundtrip(leader_fn())
    except _UserError as e:
        _ROLE[0] = "validator"
        try:
            agreed = validator_fn(e)
        except Exception:
            agreed = False
        finally:
            _ROLE[0] = "leader"
        raise _UserError(e.data if agreed else
                         "[LLM_ERROR] validators disagreed with the leader's failure")
    _ROLE[0] = "validator"
    try:
        ok = validator_fn(_Return(value))
    except Exception:
        ok = False
    finally:
        _ROLE[0] = "leader"
    if not ok:
        raise _UserError("[LLM_ERROR] validators did not agree with the leader")
    return value


class _TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls

    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _Address:
    def __init__(self, v):
        text = str(v).strip()
        if not (text.startswith("0x") and len(text) == 42):
            raise ValueError("not an address")
        int(text[2:], 16)
        self.as_hex = to_checksum_address(text)

    def __str__(self):
        return self.as_hex


class _ViewDeco:
    def __call__(self, fn):
        return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)

    def __call__(self, fn):
        return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


def _sniff_ok(img: bytes) -> bool:
    return img[:8] == b"\x89PNG\r\n\x1a\n" or img[:4] == b"\xff\xd8\xff\xe0"


def _exec_prompt(prompt, response_format=None, images=None):
    role = _ROLE[0]
    kind = "look" if images else "judge"
    if images is not None:
        if len(images) > 2:
            raise RuntimeError("TOO_MANY_IMAGES")
        for img in images:
            if len(img) > 5 * 1024 * 1024:
                raise RuntimeError("IMAGE_TOO_LARGE")
            if not _sniff_ok(bytes(img)):
                raise RuntimeError("INVALID_IMAGE")
    _PROMPTS.append({"role": role, "kind": kind, "prompt": prompt,
                     "images": len(images or [])})
    queue = _ANSWERS[kind][role] or _ANSWERS[kind]["leader"]
    if not queue:
        raise _NoAnswer(f"test ran a {kind} prompt without an answer for it")
    idx = min(_CALLS[kind][role], len(queue) - 1)
    _CALLS[kind][role] += 1
    answer = queue[idx]
    if callable(answer):
        answer = answer(prompt, images)
    if isinstance(answer, BaseException):
        raise answer
    return answer


class _PayeeProxy:
    def __init__(self, addr):
        self.addr = str(addr)

    def emit_transfer(self, value=0):
        _TRANSFERS.append({"to": self.addr, "wei": int(value)})


def _contract_interface(cls):
    return _PayeeProxy


def _print_hook(*args, **kwargs):
    _PRINTS.append(" ".join(str(a) for a in args))


def _install():
    gl = types.ModuleType("genlayer")
    gl.public = _Public()
    gl.contract = types.SimpleNamespace(Contract=type("Contract", (), {}))
    gl.storage = types.SimpleNamespace(TreeMap=_TreeMap)
    gl.vm = types.SimpleNamespace(UserError=_UserError, VMError=_VMError,
                                  Return=_Return, run_nondet=_run_nondet)
    gl.nondet = types.SimpleNamespace(exec_prompt=_exec_prompt,
                                      web=types.SimpleNamespace())
    gl.message = types.SimpleNamespace(sender_address=DEPLOYER, value=0)
    gl.evm = types.SimpleNamespace(contract_interface=_contract_interface)
    gl_types = types.ModuleType("genlayer.types")
    gl_types.u256 = _U256
    gl_types.Address = _Address
    gl.types = gl_types
    sys.modules["genlayer"] = gl
    sys.modules["genlayer.types"] = gl_types
    return gl


class _FakeDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return _NOW[0]


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("everkeep_contract", CONTRACT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.print = _print_hook
    mod.datetime = _FakeDateTime
    return mod


@pytest.fixture
def module():
    # The stub SDK must not outlive its test: the official-runner suite loads
    # the real `genlayer` in the same session.
    saved = {k: v for k, v in sys.modules.items()
             if k == "genlayer" or k.startswith("genlayer.")}
    try:
        yield _load()
    finally:
        for k in [k for k in sys.modules if k == "genlayer" or k.startswith("genlayer.")]:
            del sys.modules[k]
        sys.modules.update(saved)


if sys.platform == "win32":
    # genlayer-test's direct loader unlinks a temp file it still holds open,
    # which POSIX allows and Windows refuses; tolerate exactly that locally.
    _real_unlink = os.unlink

    def _tolerant_unlink(path, *args, **kwargs):
        try:
            _real_unlink(path, *args, **kwargs)
        except PermissionError:
            pass

    os.unlink = _tolerant_unlink


_TREES = ("counters", "organizations", "constitutions", "assets", "org_assets", "work_orders",
          "org_orders", "role_index", "items", "item_bytes", "item_text", "version_items",
          "rounds", "ledger", "events")

_PUBLIC_WRITES = ("create_organization", "fund_treasury", "propose_amendment", "object_amendment",
                  "ratify_amendment", "pause_organization", "resume_organization",
                  "register_asset", "accept_inspector_role", "create_work_order",
                  "accept_work_order", "propose_version", "cancel_work_order",
                  "submit_image", "submit_document", "submit_declaration", "submit_reference",
                  "request_assessment", "open_appeal", "decide_appeal", "lapse_appeal",
                  "finalize", "close_work_order", "claim")


def _revert_on_raise(inst, name):
    fn = getattr(inst, name)

    def wrapped(*args, **kwargs):
        snapshot = {t: dict(getattr(inst, t)) for t in _TREES}
        n_transfers = len(_TRANSFERS)
        try:
            return fn(*args, **kwargs)
        except BaseException:
            for t, data in snapshot.items():
                tree = getattr(inst, t)
                tree.clear()
                tree.update(data)
            del _TRANSFERS[n_transfers:]
            raise

    return wrapped


def _fresh_instance(mod):
    inst = mod.Everkeep.__new__(mod.Everkeep)
    for name in _TREES:
        setattr(inst, name, _TreeMap())
    mod.gl.message.sender_address = DEPLOYER
    mod.gl.message.value = 0
    inst.__init__()
    for name in _PUBLIC_WRITES:
        setattr(inst, name, _revert_on_raise(inst, name))
    return inst


def _reset():
    _ROLE[0] = "leader"
    for kind in _ANSWERS:
        for role in _ANSWERS[kind]:
            _ANSWERS[kind][role].clear()
            _CALLS[kind][role] = 0
    _PROMPTS.clear()
    _FORGED.clear()
    _ACCEPTED.clear()
    _PRINTS.clear()
    _TRANSFERS.clear()
    _NOW[0] = datetime(2026, 9, 20, 9, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def c(module):
    _reset()
    return _fresh_instance(module)


# ── helpers ──────────────────────────────────────────────────────────────────

def as_(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def err(module):
    return module.gl.vm.UserError


def set_now(iso):
    _NOW[0] = datetime.fromisoformat(iso.replace("Z", "+00:00"))


def reset_prompts():
    _PROMPTS.clear()


def prompts(kind=None, role=None):
    return [p for p in _PROMPTS if (kind is None or p["kind"] == kind)
            and (role is None or p["role"] == role)]


def prints():
    return list(_PRINTS)


def transfers():
    return list(_TRANSFERS)


def forge_leader(value):
    _FORGED.append(value)


def network_accepts(value):
    """The next round's consensus result, as if the network had accepted it."""
    _ACCEPTED.append(value)


def jfif(tag=b"", size=4000):
    """A JPEG with the JFIF header GenVM's gateway accepts."""
    body = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + tag
    return body + b"\x00" * max(0, size - len(body))


def png(tag=b"", size=2000):
    body = b"\x89PNG\r\n\x1a\n" + tag
    return body + b"\x00" * max(0, size - len(body))


def exif_jpeg(size=4000):
    body = b"\xff\xd8\xff\xe1\x00\x10Exif\x00"
    return body + b"\x00" * max(0, size - len(body))





# ── the domain: parties, constitution, terms, evidence, model answers ─────────

from _fixtures import (  # noqa: E402  (after the stub is installed)
    CRITERIA, DEADLINE, PRINCIPLES, asset, constitution, judge_all, judge_answer,
    look_all, look_answer, terms,
)


def create_org(module, c, escrow=10 * GEN, stewards=None, **over):
    as_(module, FOUNDER, escrow)
    out = json.loads(c.create_organization(constitution(stewards or [FOUNDER, STEWARD2], **over)))
    assert out["refused"] is False, out
    return out["organization_id"]


def register(module, c, oid, who=FOUNDER, **over):
    as_(module, who)
    return json.loads(c.register_asset(oid, asset(**over)))["asset_id"]


def create_order(module, c, aid, provider=PROVIDER, who=FOUNDER, **over):
    as_(module, who)
    return json.loads(c.create_work_order(aid, provider, terms(**over)))["work_order_id"]


def active_order(module, c, escrow=10 * GEN, inspector="", org_over=None, asset_over=None,
                 **terms_over):
    """An organisation with one asset and one work order the provider signed."""
    oid = create_org(module, c, escrow=escrow, **(org_over or {}))
    aid = register(module, c, oid, inspector=inspector, **(asset_over or {}))
    if inspector:
        as_(module, inspector)
        c.accept_inspector_role(aid)
    wid = create_order(module, c, aid, **terms_over)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 1)
    return oid, aid, wid


def image(module, c, wid, who=PROVIDER, crit="C1", data=None,
          caption="The replacement inverter on the plant-room wall", origin="PHOTO", **meta):
    as_(module, who)
    m = {"criterion_id": crit, "caption": caption, "origin": origin,
         "claimed_capture": "2026-09-24", "claimed_location": "Ahero health centre"}
    m.update(meta)
    return json.loads(c.submit_image(wid, json.dumps(m),
                                     data if data is not None else jfif(caption.encode())))["item_id"]


def document(module, c, wid, who=PROVIDER, crit="", title="Technical report",
             doc_type="TECHNICAL_REPORT",
             text="Replaced the faulted 5 kW inverter with a 6 kW unit; commissioned and producing.",
             reference="TR-0424"):
    as_(module, who)
    meta = {"criterion_id": crit, "title": title, "doc_type": doc_type, "reference": reference}
    return json.loads(c.submit_document(wid, json.dumps(meta), text))["item_id"]


def declaration(module, c, wid, who=PROVIDER, text="The array is repaired and producing."):
    as_(module, who)
    return json.loads(c.submit_declaration(wid, text))["item_id"]


def reference(module, c, wid, who=PROVIDER, url="https://example.org/video/commissioning.mp4",
              claimed_sha256="a" * 64, reference_type="VIDEO_REFERENCE"):
    as_(module, who)
    meta = {"url": url, "claimed_sha256": claimed_sha256, "reference_type": reference_type,
            "caption": "Commissioning walk-through"}
    return json.loads(c.submit_reference(wid, json.dumps(meta)))["item_id"]


def _resolve_basis(answer, default_basis):
    """The fixtures cite "*" as a basis: the harness resolves it to a real
    item of the round, so a default answer is grounded on an image and a
    test that wants paperwork as the basis names the document itself."""
    if callable(answer) or isinstance(answer, BaseException) or not isinstance(answer, dict):
        return answer
    for key in ("principles", "criteria"):
        for row in answer.get(key) or []:
            if isinstance(row, dict) and row.get("basis") == ["*"]:
                row["basis"] = [default_basis]
    return answer


def llm(look=None, judge=None, v_look=None, v_judge=None, default_basis="ev-000001"):
    """Queue model answers; validator queues default to the leader's."""
    if judge is not None:
        judge = [_resolve_basis(a, default_basis) for a in judge] if isinstance(judge, list)             else _resolve_basis(judge, default_basis)
    if v_judge is not None:
        v_judge = [_resolve_basis(a, default_basis) for a in v_judge] if isinstance(v_judge, list)             else _resolve_basis(v_judge, default_basis)
    for kind, leader, validator in (("look", look, v_look), ("judge", judge, v_judge)):
        _ANSWERS[kind]["leader"].clear()
        _ANSWERS[kind]["validator"].clear()
        _CALLS[kind]["leader"] = 0
        _CALLS[kind]["validator"] = 0
        if leader is not None:
            _ANSWERS[kind]["leader"].extend(leader if isinstance(leader, list) else [leader])
        if validator is not None:
            _ANSWERS[kind]["validator"].extend(validator if isinstance(validator, list) else [validator])


def assess(module, c, wid, items, look=None, judge=None, **kw):
    llm(look=look if look is not None else look_all(),
        judge=judge if judge is not None else judge_all(),
        default_basis=items[0] if items else "ev-000001", **kw)
    as_(module, PROVIDER)
    return json.loads(c.request_assessment(wid, json.dumps(items)))


def claimable(c, addr):
    return int(json.loads(c.get_balance(addr))["claimable"])


def order(c, wid):
    return json.loads(c.get_work_order(wid))


def org(c, oid):
    return json.loads(c.get_organization(oid))


def rounds(c, wid, n):
    return json.loads(c.get_round(wid, n))
