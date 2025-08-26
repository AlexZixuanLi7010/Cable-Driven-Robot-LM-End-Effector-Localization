function out = optimize_pose(a, b, l, y_prev)
  arguments
    a double; b double; l double; y_prev double
  end

  m = size(a,1);
  assert(size(a,2)==3 && size(b,2)==3 && size(b,1)==m, 'a/b size mismatch');
  assert(isvector(l) && numel(l)==m, 'l must be m-by-1');
  assert(isvector(y_prev) && numel(y_prev)==6, 'y_prev must be 6-by-1');

  % ---- collect resnorm (sum of squared residuals) every iteration ----
  errHistory = [];  % resnorm per iteration
  function stop = outfun(~,optimValues,state)
    stop = false;
    if strcmp(state,'iter')
      errHistory(end+1) = optimValues.resnorm; %#ok<AGROW>
    end
  end

  % Solver options
  opts = optimoptions('lsqnonlin', ...
    'Algorithm','levenberg-marquardt', ...
    'Display','off', ...
    'TolX',1e-10, ...
    'TolFun',1e-10, ...
    'MaxIterations',200, ...
    'OutputFcn',@outfun);

  % Residual function
  resid = @(y) computeResiduals(y,a,b,l);

  % Solve
  [y_opt,resnorm,~,exitflag,output] = lsqnonlin(resid,y_prev,[],[],opts);

  % ---- package output ----
  out.y_opt      = y_opt(:);
  out.error      = resnorm;          % final error (sum of squares)
  out.residuals  = errHistory(:)';   % ERROR HISTORY per iteration  <-- frontend plots this
  if isstruct(output) && isfield(output,'iterations')
    out.iterations = output.iterations;
  else
    out.iterations = numel(errHistory);
  end
  out.exitflag   = exitflag;
end

function F = computeResiduals(y, a, b, l)
  r = y(1:3);
  angles = y(4:6);
  R = rotational_matrix(angles);
  m = size(a,1);
  F = zeros(m,1);
  for i = 1:m
    pred = norm( a(i,:)' - r - R*b(i,:)' );
    F(i) = (pred - l(i));
  end
end

function R = rotational_matrix(angles)
  phi = angles(1); theta = angles(2); psi = angles(3);
  Rx = [1 0 0; 0 cos(phi) -sin(phi); 0 sin(phi) cos(phi)];
  Ry = [cos(theta) 0 sin(theta); 0 1 0; -sin(theta) 0 cos(theta)];
  Rz = [cos(psi) -sin(psi) 0; sin(psi) cos(psi) 0; 0 0 1];
  R = Rz*Ry*Rx;
end
