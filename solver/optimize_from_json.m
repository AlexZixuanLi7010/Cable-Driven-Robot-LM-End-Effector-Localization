function optimize_from_json(inPath, outPath)
% Usage from terminal: matlab -batch "optimize_from_json('input.json','output.json')"
  data = jsondecode(fileread(inPath));

  a = data.anchors;         % m x 3
  b = data.attachments;     % m x 3
  l = data.cableLengths(:); % m x 1
  y0 = data.initialGuess(:);% 6 x 1

  out = optimize_pose(a, b, l, y0);

  result.pose       = out.y_opt(:).';
  result.error      = out.error;
  result.iterations = out.iterations;
  result.residuals  = out.residuals(:).';

  fid = fopen(outPath,'w'); fwrite(fid, jsonencode(result),'char'); fclose(fid);
end
