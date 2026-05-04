# TeamLoad Product Economics Audit

This document answers 50 economic and product-technical questions to guide TeamLoad from prototype toward a product that can be sold, retained and scaled.

## Executive conclusion

TeamLoad should not position itself as a generic fitness tracker. The strongest wedge is a coach operating system for team sports where attendance, availability and load decisions are currently spread across WhatsApp, spreadsheets, calendars and memory. The first commercial buyer is likely a head coach, academy coordinator or small club director who feels the pain of unreliable availability, manual attendance and missing load context.

The next build priorities are:

1. Make the first-run coach workflow obvious and demoable.
2. Persist availability and final attendance in Supabase.
3. Turn the landing page into a product-led sales page with ICP, ROI and pricing signals.
4. Make mobile coach workflows fast enough for practice and game day.
5. Add team-level trust: roles, auditability, export and data ownership.

## 50 questions and answers

### Market and customer

1. **Who is the first ideal customer?**
   Youth academies, ambitious amateur clubs, school teams and performance-focused coaches managing 10-80 athletes.

2. **Who feels the pain most often?**
   Coaches who plan sessions and constantly chase player availability through chats.

3. **Who pays?**
   Usually the club, academy, head coach or parent-funded team budget. Individual players are weaker payers.

4. **What is the urgent pain?**
   Unclear availability, unreliable attendance records and no operational link between attendance and training load.

5. **What is the non-urgent but valuable pain?**
   Long-term workload monitoring, injury-risk awareness and performance planning.

6. **Which sport is the best beachhead?**
   Basketball is strong because rosters are small enough for onboarding, schedules are dense and load management matters.

7. **Should TeamLoad start multi-sport?**
   Product language can be multi-sport, but early demos should feel basketball-native to increase credibility.

8. **Is the market already crowded?**
   Yes, but many tools are either too enterprise-heavy or too generic. The wedge is simple coach operations plus load.

9. **What should TeamLoad not become yet?**
   A broad social fitness app, nutrition app or complex club ERP before the core team workflow works.

10. **What is the first user promise?**
    Coaches know who is expected, who is late, who is absent and what that means for team load.

### Product positioning

11. **What category should TeamLoad claim?**
    Coach OS for team sports.

12. **What is the simplest one-liner?**
    TeamLoad turns sessions, availability, attendance and load into one coach-ready workflow.

13. **What should the landing page sell first?**
    Operational clarity, not advanced analytics.

14. **What proof should the app show?**
    A working demo where a coach sees exceptions and final attendance in under 60 seconds.

15. **What is the main competitor in reality?**
    WhatsApp plus Google Sheets plus coach memory.

16. **How should TeamLoad beat spreadsheets?**
    By being faster on mobile, role-aware and less error-prone during real practice situations.

17. **Should ACWR be the hero feature?**
    No. It is a premium insight layer, not the first operational hook.

18. **Should attendance be central?**
    Yes. Attendance is the data foundation for availability, accountability and load.

19. **What should be shown in the first demo?**
    Upcoming session, expected roster, late players, absences, coach final status and load context.

20. **What should be hidden from early users?**
    Complex admin settings unless the user explicitly needs them.

### Monetization

21. **What pricing model fits best?**
    Per team per month, with club plans for multi-team organizations.

22. **What is a plausible entry price?**
    A starter team plan around 9-29 EUR/month is easier to test than individual athlete pricing.

23. **What could a club plan include?**
    Multiple teams, role permissions, departments, exports and priority support.

24. **Should there be a free plan?**
    Yes, but limited to demo/local or one small team to reduce friction.

25. **What should be paid?**
    Cloud sync, multi-coach roles, attendance history, exports, load analytics and club administration.

26. **What feature has direct willingness to pay?**
    Reliable shared availability and attendance records across devices.

27. **What feature has premium willingness to pay?**
    Load analytics, risk flags, reporting and staff-level visibility.

28. **What feature should not be monetized too early?**
    Basic onboarding. If onboarding is gated, activation will die.

29. **What is the strongest ROI argument?**
    Less time chasing players, fewer planning mistakes and better visibility into missed or modified load.

30. **What is the sales risk?**
    Coaches like the demo but do not get their team to consistently use it.

### Activation and retention

31. **What is the activation event for a coach?**
    Creating a team, creating a session and seeing at least one availability exception or final attendance row.

32. **What is the activation event for a player?**
    Seeing their calendar and successfully marking late, maybe or no.

33. **What should happen after sign-up?**
    The user should choose coach or athlete, then immediately land in a demoable workflow.

34. **What should a coach see when empty?**
    Not a blank dashboard. They need a sample workflow or guided first team/session creation.

35. **What causes retention?**
    Weekly session planning, repeated attendance capture and athlete exceptions.

36. **What causes churn?**
    If athletes do not join, coaches must duplicate work and will return to WhatsApp.

37. **What is the habit loop?**
    Coach creates week, athletes report exceptions, coach finalizes attendance, load updates.

38. **What notification is most valuable?**
    Athlete changes availability for an upcoming session.

39. **What notification is dangerous?**
    Too many generic alerts. Coaches will mute the app.

40. **What data should be visible first on mobile?**
    Today, next session, availability exceptions and attendance actions.

### Technical product risk

41. **What is the biggest technical product gap now?**
    Availability and final attendance are still local-first and not production-valid across devices.

42. **What must move to Supabase first?**
    Availability overrides and coach-final attendance records.

43. **What should remain separate in the data model?**
    Athlete availability intent, check-in/geofence evidence and coach-final attendance.

44. **What auditability is needed?**
    Final attendance should store who finalized it, when and optionally why.

45. **What privacy risk exists?**
    Athlete health/load data can be sensitive, so permissions and data visibility must be explicit.

46. **What technical debt is acceptable for now?**
    Local demo data is acceptable as long as the UI clearly labels it as demo/local.

47. **What technical debt is dangerous?**
    Letting users believe localStorage data is shared team data.

48. **What reliability feature is needed soon?**
    Clear loading, offline and save-failed states for attendance and availability.

49. **What integration can wait?**
    Payment, external calendars and advanced analytics can wait until core attendance sync works.

50. **What is the next correct engineering bet?**
    Build shared Supabase persistence for availability and final attendance after the mobile and positioning pass.

## Product decisions derived from the audit

- Keep TeamLoad focused on coaches and team operations.
- Treat attendance as the central operational workflow.
- Use load/ACWR as the higher-value insight layer, not the first activation requirement.
- Make demo mode obvious but separate from production cloud usage.
- Add pricing/ICP/ROI signals to the landing page before building payments.
- Move localStorage attendance data to Supabase before claiming production readiness.

## App changes implied

1. Landing page should include:
   - target customers,
   - buyer value,
   - pricing direction,
   - product readiness language,
   - clear distinction between demo and synced team use.

2. Coach app should emphasize:
   - next session,
   - availability exceptions,
   - attendance finalization,
   - load context.

3. Athlete app should emphasize:
   - personal team calendar,
   - exception-only availability,
   - low-friction mobile interaction.

4. Technical roadmap should prioritize:
   - Supabase persistence,
   - permissions,
   - audit fields,
   - export/reporting.
