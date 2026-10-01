"""Consultation-1 quiz -> product recommendations.

Scores the real supplier catalogue (Celadon / Lazzoni / Luxus handoff
workbooks, read in place) against the live Consultation-1 quiz answers with
the trained two-tower model from
`notebooks/learning/pytorch_recommendation_matching_demo.ipynb`, then places
one product per Design Manual §4.2 room slot within the investment band.

Using a trained model in the ranking path is an owner decision
(2026-09-30) that overrides `ADR-0024` D6; see `ADR-0025`.
"""
