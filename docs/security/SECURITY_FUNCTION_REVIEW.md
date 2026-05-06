# SECURITY DEFINER Function Review

Purpose:

Track all currently exposed SECURITY DEFINER functions and define the intended long-term authorization model.

---

# Current exposed functions

## att_session_trainer(p_session_id text)

Current state:

- SECURITY DEFINER
- executable by anon
- executable by authenticated

Risk:

Potential unauthorized visibility into trainer/session relationships.

Recommended direction:

- remove anon execution if public access is not required
- prefer SECURITY INVOKER where possible
- validate requesting actor against team/session ownership

---

## att_team_trainer(p_team_id text)

Current state:

- SECURITY DEFINER
- executable by anon
- executable by authenticated

Risk:

Potential unauthorized team-trainer discovery.

Recommended direction:

- restrict execution
- validate membership or coach assignment

---

## get_roster_team_memberships(p_user_id text)

Current state:

- SECURITY DEFINER
- executable through API

Risk:

Potential enumeration of roster relationships.

Recommended direction:

- allow only self-access or coach/admin access
- validate organization/team relationship

---

## get_trainer_data(share_token text)

Current state:

- SECURITY DEFINER
- token-based access

This function may intentionally support public trainer-share flows.

Recommended direction:

- keep token validation strict
- add expiration validation
- audit exposed fields
- rate limit public usage if possible

---

## lookup_user_by_share_token(p_token text)

Current state:

- SECURITY DEFINER
- executable through API

Risk:

Potential user/token enumeration.

Recommended direction:

- ensure one-time or expiring tokens
- minimize returned data
- audit brute-force exposure

---

# Important implementation rule

Do not remove SECURITY DEFINER blindly.

Some functions may currently depend on elevated execution privileges because RLS is not fully deployed yet.

The correct order is:

1. establish stable RLS model
2. introduce helper authorization functions
3. migrate policies
4. then reduce SECURITY DEFINER usage where safe
