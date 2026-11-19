import math
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakeSphere, BRepPrimAPI_MakeCone, BRepPrimAPI_MakeTorus, BRepPrimAPI_MakeRevol, BRepPrimAPI_MakePrism
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse, BRepAlgoAPI_Common
from OCP.BRepBuilderAPI import BRepBuilderAPI_NurbsConvert, BRepBuilderAPI_MakeEdge, BRepBuilderAPI_MakeWire, BRepBuilderAPI_MakeFace, BRepBuilderAPI_MakePolygon
from OCP.BRepOffsetAPI import BRepOffsetAPI_ThruSections
from OCP.GeomAPI import GeomAPI_PointsToBSpline
from OCP.collections import Array1_gp_Pnt as TColgp_Array1OfPnt
from OCP.gp import gp_Ax2, gp_Ax1, gp_Pnt, gp_Dir, gp_Vec, gp_Circ
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.Interface import Interface_Static
from OCP.TopoDS import TopoDS_Compound
from OCP.BRep import BRep_Builder
def ax(x, y, z, dx=0, dy=0, dz=1): return gp_Ax2(gp_Pnt(x, y, z), gp_Dir(dx, dy, dz))
def save(name, s, unit=None):
    if unit: Interface_Static.SetCVal_s('write.step.unit', unit)
    w = STEPControl_Writer(); w.Transfer(s, STEPControl_AsIs); w.Write(name + '.step')
    if unit: Interface_Static.SetCVal_s('write.step.unit', 'MM')
    g = GProp_GProps(); BRepGProp.VolumeProperties_s(s, g); print(name, 'volume %.4f' % g.Mass())
def spline(pts):
    a = TColgp_Array1OfPnt(1, len(pts))
    for i, p in enumerate(pts): a.SetValue(i + 1, gp_Pnt(*p))
    return GeomAPI_PointsToBSpline(a).Curve()
box = BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 60, 40, 10).Shape()
br = BRepAlgoAPI_Cut(BRepAlgoAPI_Fuse(box, BRepPrimAPI_MakeCylinder(ax(30, 20, 0), 10, 25).Shape()).Shape(), BRepPrimAPI_MakeCylinder(ax(30, 20, -1), 5, 30).Shape()).Shape()
save('occ2_nurbs_bracket', BRepBuilderAPI_NurbsConvert(br).Shape())
save('occ2_nurbs_sphere', BRepBuilderAPI_NurbsConvert(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape()).Shape())
save('occ2_nurbs_torus', BRepBuilderAPI_NurbsConvert(BRepPrimAPI_MakeTorus(ax(0, 0, 0), 20, 5).Shape()).Shape())
# a vase: a spline profile turned round the axis
c = spline([(10, 0, 0), (16, 0, 8), (9, 0, 18), (6, 0, 28), (11, 0, 36)])
w = BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(10, 0, 0)).Edge(), BRepBuilderAPI_MakeEdge(c).Edge(), BRepBuilderAPI_MakeEdge(gp_Pnt(11, 0, 36), gp_Pnt(0, 0, 36)).Edge(), BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 36), gp_Pnt(0, 0, 0)).Edge()).Wire()
vase = BRepPrimAPI_MakeRevol(BRepBuilderAPI_MakeFace(w).Face(), gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1))).Shape()
save('occ2_vase', vase)
save('occ2_vase_hole', BRepAlgoAPI_Cut(vase, BRepPrimAPI_MakeCylinder(ax(-30, 0, 12, 1, 0, 0), 3, 60).Shape()).Shape())
# a spline outline pushed straight up
c2 = spline([(0, 0, 0), (10, 8, 0), (25, -4, 0), (40, 6, 0)])
w2 = BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(c2).Edge(), BRepBuilderAPI_MakeEdge(gp_Pnt(40, 6, 0), gp_Pnt(40, 30, 0)).Edge(), BRepBuilderAPI_MakeEdge(gp_Pnt(40, 30, 0), gp_Pnt(0, 30, 0)).Edge(), BRepBuilderAPI_MakeEdge(gp_Pnt(0, 30, 0), gp_Pnt(0, 0, 0)).Edge()).Wire()
pr = BRepPrimAPI_MakePrism(BRepBuilderAPI_MakeFace(w2).Face(), gp_Vec(0, 0, 12)).Shape()
save('occ2_prism', pr)
save('occ2_prism_hole', BRepAlgoAPI_Cut(pr, BRepPrimAPI_MakeCylinder(ax(20, -10, 6, 0, 1, 0), 2.5, 60).Shape()).Shape())
# a loft from a square to a circle
ts = BRepOffsetAPI_ThruSections(True, False)
ts.AddWire(BRepBuilderAPI_MakePolygon(gp_Pnt(-10, -10, 0), gp_Pnt(10, -10, 0), gp_Pnt(10, 10, 0), gp_Pnt(-10, 10, 0), True).Wire())
ts.AddWire(BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(gp_Circ(ax(0, 0, 25), 6)).Edge()).Wire()); ts.Build()
save('occ2_loft', ts.Shape())
save('occ2_sphere_drilled', BRepAlgoAPI_Cut(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape(), BRepPrimAPI_MakeCylinder(ax(0, 0, -20), 5, 40).Shape()).Shape())
save('occ2_sphere_side', BRepAlgoAPI_Cut(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape(), BRepPrimAPI_MakeCylinder(ax(4, -20, 3, 0, 1, 0), 4, 40).Shape()).Shape())
save('occ2_sphere_blind', BRepAlgoAPI_Cut(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape(), BRepPrimAPI_MakeCylinder(ax(8, 0, 4, 1, 0.3, 0.2), 3, 40).Shape()).Shape())
save('occ2_torus_cut', BRepAlgoAPI_Cut(BRepPrimAPI_MakeTorus(ax(0, 0, 0), 20, 5).Shape(), BRepPrimAPI_MakeBox(gp_Pnt(0, -30, -10), 30, 60, 20).Shape()).Shape())
save('occ2_torus_hole', BRepAlgoAPI_Cut(BRepPrimAPI_MakeTorus(ax(0, 0, 0), 20, 5).Shape(), BRepPrimAPI_MakeCylinder(ax(20, 0, -10), 2, 20).Shape()).Shape())
save('occ2_cone_hole', BRepAlgoAPI_Cut(BRepPrimAPI_MakeCone(ax(0, 0, 0), 15, 5, 20).Shape(), BRepPrimAPI_MakeCylinder(ax(-30, 0, 8, 1, 0, 0), 2, 60).Shape()).Shape())
save('occ2_hollow', BRepAlgoAPI_Cut(BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 30, 30, 30).Shape(), BRepPrimAPI_MakeSphere(gp_Pnt(15, 15, 15), 10).Shape()).Shape())
save('occ2_lens', BRepAlgoAPI_Common(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 15).Shape(), BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 20), 15).Shape()).Shape())
comp = TopoDS_Compound(); bb = BRep_Builder(); bb.MakeCompound(comp); bb.Add(comp, box); bb.Add(comp, BRepPrimAPI_MakeSphere(gp_Pnt(100, 0, 0), 15).Shape())
save('occ2_two_inch', comp, 'INCH')
